const Appointment = require('../models/appointment');
const Professional = require('../models/professional');
const Service = require('../models/service');
const Client = require('../models/client');
const notificationService = require('../services/notification');
const {  getProfessionalId, canViewAllData } = require('../utils/userHelper');

const getDayName = (dayIndex) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex];
};


// Função atualizada para obter o ID do proprietário de forma mais robusta
const getOwnerUserId = async (req) => {
    if (req.user.role === 'professional') {
      // Se for um profissional, verifica primeiro se tem parentId no objeto user
      if (req.user.parentId) {
        // Se tiver parentId diretamente no objeto user, use-o
        console.log('Id do professional encontrado', req.user.parentId)
        return req.user.parentId;
      }
      
      // Caso contrário, busca o profissional para encontrar a conta proprietária
      const professional = await Professional.findOne({ userAccountId: req.user._id });
      
      if (!professional) {
        // Se não encontrar o profissional, lança um erro específico
        throw new Error('Perfil profissional não encontrado. Por favor, contate o administrador.');
      }
      
      // Retorna o userId do professional (que é o ID do proprietário)
      return professional.userId;
    }
    
    // Se for owner ou admin, usa o próprio ID
    return req.user._id;
  };

  
// Helper function to check availability
// Substitua a função checkAvailability por esta implementação corrigida
// Corrigir a assinatura da função para incluir o parâmetro excludeAppointmentId
const checkAvailability = async (professionalId, date, duration, excludeAppointmentId = null, allowOverride = false) => {
    // Get professional details
    const professional = await Professional.findById(professionalId);
    if (!professional) {
        throw new Error('Professional not found');
    }

    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.getDay();
    const dayName = getDayName(dayOfWeek);
    
    // Extract hours and minutes
    const hours = appointmentDate.getHours().toString().padStart(2, '0');
    const minutes = appointmentDate.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    // Check if professional works on this day
    if (!professional.workingHours || !professional.workingHours[dayName] || 
        !professional.workingHours[dayName].start || !professional.workingHours[dayName].end) {
        throw new Error('Professional not working on this day');
    }

    // Check working hours
    const startTime = professional.workingHours[dayName].start;
    const endTime = professional.workingHours[dayName].end;

    const isOutsideHours = timeString < startTime || timeString > endTime;
    if (isOutsideHours && !allowOverride) {
        throw new Error('Time outside working hours');
    }

    // Calculate the end time of the new appointment
    const endTimeDate = new Date(appointmentDate.getTime() + (duration * 60000));

    // Get all appointments for that day
    const dayStart = new Date(appointmentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(appointmentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const query = {
        professionalId,
        status: { $in: ['scheduled', 'confirmed'] }
    };
    
    if (excludeAppointmentId) {
        query._id = { $ne: excludeAppointmentId };
    }
    
    const allAppointments = await Appointment.find(query);

    // Check for conflicts manually
    const appointmentStartTime = appointmentDate.getTime();
    const appointmentEndTime = endTimeDate.getTime();
    
    // Verificar conflitos manualmente em JavaScript
    const conflictingAppointment = allAppointments.find(apt => {
        const aptStartTime = apt.date.getTime();
        const aptEndTime = aptStartTime + (apt.duration * 60000);
        
        // Verifica sobreposição: 
        // Se o início do novo agendamento é antes do fim do existente
        // E o fim do novo agendamento é depois do início do existente
        return (appointmentStartTime < aptEndTime && appointmentEndTime > aptStartTime);
    });

    console.log('Manual conflict check:', {
        newAppointment: {
            start: appointmentDate.toISOString(),
            startMs: appointmentStartTime,
            end: endTimeDate.toISOString(),
            endMs: appointmentEndTime
        },
        allAppointments: allAppointments.map(a => {
            const start = a.date.getTime();
            const end = start + (a.duration * 60000);
            return {
                id: a._id,
                start: a.date.toISOString(),
                startMs: start,
                end: new Date(end).toISOString(),
                endMs: end,
                hasConflict: (appointmentStartTime < end && appointmentEndTime > start)
            };
        })
    });

    if (conflictingAppointment && !allowOverride) {
        throw new Error('Time slot conflicts with existing appointment');
    }

    // Check max overrides per day (default: 2)
    if (allowOverride) {
        const maxOverridesPerDay = 2; // Default value
        const overridesCount = await Appointment.countDocuments({
            professionalId,
            date: { $gte: dayStart, $lte: dayEnd },
            isOverride: true
        });
        
        if (overridesCount >= maxOverridesPerDay) {
            throw new Error(`Maximum number of overrides (${maxOverridesPerDay}) for this day has been reached`);
        }
    }

    return {
        isAvailable: true,
        isOutsideHours,
        isOverride: conflictingAppointment ? true : isOutsideHours
    };
};

// Create new appointment
exports.createAppointment = async (req, res) => {
    try {
      const { 
        clientId, 
        professionalId, 
        serviceId, 
        date, 
        notes, 
        color = 'default', 
        sendReminder = true, 
        isOverride = false, 
        recurrence = null 
      } = req.body;
  
      // Obter ID do usuário proprietário para salvar os dados
      const ownerUserId = await getOwnerUserId(req);
  
      // Validate entities exist
      const [client, professional, service] = await Promise.all([
        Client.findById(clientId),
        Professional.findById(professionalId),
        Service.findById(serviceId)
      ]);
  
      if (!client || !professional || !service) {
        return res.status(404).json({
          status: 'error',
          message: 'Cliente, profissional ou serviço não encontrado'
        });
      }
  
      console.log('Creating appointment:', {
        userId: ownerUserId,
        professionalId,
        date: new Date(date),
        duration: service.duration
      });
  
      // Verify availability
      const availability = await checkAvailability(
        professionalId, 
        date, 
        service.duration, 
        null,
        isOverride
      );
  
      // Create appointment
      const appointment = new Appointment({
        userId: ownerUserId, // Salva na conta do proprietário
        clientId,
        professionalId,
        serviceId,
        date,
        notes,
        duration: service.duration,
        status: req.body.status || 'scheduled',
        color,
        sendReminder,
        isOverride: availability.isOverride
      });
  
      // Configure recurrence if applicable
      if (recurrence && recurrence.isRecurring) {
        appointment.recurrence = {
          isRecurring: true,
          pattern: recurrence.pattern || 'weekly',
          interval: recurrence.interval || 1,
          endDate: recurrence.endDate || null,
          occurrences: recurrence.occurrences || null
        };
      }
  
      await appointment.save();
  
      // If it's a recurring appointment, create all occurrences
      let recurringAppointments = [];
      if (recurrence && recurrence.isRecurring) {
        recurringAppointments = await createRecurringAppointments(
          appointment, 
          recurrence, 
          ownerUserId // Usa o ID do proprietário para os agendamentos recorrentes
        );
      }
  
      // Create notification for new appointment
      const formattedDate = new Date(date).toLocaleString();
      await notificationService.createNotification({
        userId: professional.userAccountId || professional._id,
        title: "Novo agendamento",
        message: `Agendamento com ${client.name} para ${formattedDate}`,
        type: "appointment",
        relatedTo: {
          model: "Appointment",
          id: appointment._id
        }
      });
  
      res.status(201).json({
        status: 'success',
        data: { 
          appointment,
          recurringAppointments: recurringAppointments.length > 0 ? recurringAppointments : undefined,
          isOutsideWorkingHours: availability.isOutsideHours
        }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };
  

// Helper function to create recurring appointments
async function createRecurringAppointments(originalAppointment, recurrence, userId) {
    const recurringAppointments = [];
    const { pattern, interval, endDate, occurrences } = recurrence;
    
    let currentDate = new Date(originalAppointment.date);
    let count = 0;
    
    // Determine end condition
    const hasEndDate = endDate != null;
    const hasOccurrences = occurrences != null && occurrences > 0;
    const maxOccurrences = hasOccurrences ? occurrences : 52; // Default to max 1 year of weekly appointments
    
    while (count < maxOccurrences) {
        // Add interval based on pattern
        switch (pattern) {
            case 'daily':
                currentDate.setDate(currentDate.getDate() + interval);
                break;
            case 'weekly':
                currentDate.setDate(currentDate.getDate() + (interval * 7));
                break;
            case 'monthly':
                currentDate.setMonth(currentDate.getMonth() + interval);
                break;
            default:
                break;
        }
        
        // Check if we've passed the end date
        if (hasEndDate && currentDate > new Date(endDate)) {
            break;
        }
        
        count++;
        
        // Skip the first occurrence as that's the original appointment
        if (count === 0) continue;
        
        // Create the recurring appointment
        const recurringAppointment = new Appointment({
            userId,
            clientId: originalAppointment.clientId,
            professionalId: originalAppointment.professionalId,
            serviceId: originalAppointment.serviceId,
            date: new Date(currentDate),
            notes: originalAppointment.notes,
            duration: originalAppointment.duration,
            status: originalAppointment.status,
            color: originalAppointment.color,
            sendReminder: originalAppointment.sendReminder,
            recurrence: {
                isRecurring: true,
                pattern,
                interval,
                endDate: recurrence.endDate,
                occurrences: recurrence.occurrences,
                parentAppointmentId: originalAppointment._id
            }
        });
        
        try {
            await recurringAppointment.save();
            recurringAppointments.push(recurringAppointment);
        } catch (error) {
            console.error(`Could not create recurring appointment: ${error.message}`);
            // Continue creating the rest of the appointments
        }
    }
    
    return recurringAppointments;
}

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
    try {
      const ownerUserId = await getOwnerUserId(req);
      
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        userId: ownerUserId // Busca na conta do proprietário
      }).populate('clientId').populate('professionalId');
  
      if (!appointment) {
        return res.status(404).json({
          status: 'error',
          message: 'Agendamento não encontrado'
        });
      }
  
      appointment.status = 'cancelled';
      await appointment.save();
  
      // Create notification for cancelled appointment
      const formattedDate = appointment.date.toLocaleString();
      await notificationService.createNotification({
        userId: appointment.professionalId.userAccountId || appointment.professionalId._id,
        title: "Agendamento cancelado",
        message: `Agendamento com ${appointment.clientId.name} para ${formattedDate} foi cancelado`,
        type: "appointment_cancelled",
        relatedTo: {
          model: "Appointment",
          id: appointment._id
        }
      });
  
      // Check if this is a recurring appointment and we need to cancel all future occurrences
      const cancelAllFuture = req.query.cancelAllFuture === 'true';
      
      if (cancelAllFuture && appointment.recurrence && appointment.recurrence.isRecurring) {
        // Cancel future appointments if this is part of a recurring series
        let futureCancellations = 0;
        
        if (appointment.recurrence.parentAppointmentId) {
          // This is a child appointment, cancel all future from this one
          const futureAppointments = await Appointment.find({
            'recurrence.parentAppointmentId': appointment.recurrence.parentAppointmentId,
            date: { $gte: appointment.date },
            status: { $ne: 'cancelled' },
            userId: ownerUserId // Busca na conta do proprietário
          });
          
          for (const appt of futureAppointments) {
            appt.status = 'cancelled';
            await appt.save();
            futureCancellations++;
          }
        } else {
          // This is a parent appointment, cancel all children
          const childAppointments = await Appointment.find({
            'recurrence.parentAppointmentId': appointment._id,
            status: { $ne: 'cancelled' },
            userId: ownerUserId // Busca na conta do proprietário
          });
          
          for (const appt of childAppointments) {
            appt.status = 'cancelled';
            await appt.save();
            futureCancellations++;
          }
        }
        
        return res.status(200).json({
          status: 'success',
          data: { 
            appointment,
            futureCancellations
          },
          message: `Agendamento cancelado junto com ${futureCancellations} ocorrências futuras`
        });
      }
  
      res.status(200).json({
        status: 'success',
        data: { appointment }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };
  

// Confirm appointment
exports.confirmAppointment = async (req, res) => {
    try {
      const ownerUserId = await getOwnerUserId(req);
      
      const appointment = await Appointment.findOne({
        _id: req.params.id,
        userId: ownerUserId // Busca na conta do proprietário
      }).populate('clientId').populate('professionalId');
  
      if (!appointment) {
        return res.status(404).json({
          status: 'error',
          message: 'Agendamento não encontrado'
        });
      }
  
      appointment.status = 'confirmed';
      await appointment.save();
  
      // Create notification for confirmed appointment
      const formattedDate = appointment.date.toLocaleString();
      await notificationService.createNotification({
        userId: appointment.professionalId.userAccountId || appointment.professionalId._id,
        title: "Agendamento confirmado",
        message: `Agendamento com ${appointment.clientId.name} para ${formattedDate} foi confirmado`,
        type: "appointment_confirmed",
        relatedTo: {
          model: "Appointment",
          id: appointment._id
        }
      });
  
      // Check if we need to confirm all future recurring appointments
      const confirmAllFuture = req.query.confirmAllFuture === 'true';
      
      if (confirmAllFuture && appointment.recurrence && appointment.recurrence.isRecurring) {
        let futureConfirmations = 0;
        
        if (appointment.recurrence.parentAppointmentId) {
          // This is a child appointment, confirm all future from this one
          const futureAppointments = await Appointment.find({
            'recurrence.parentAppointmentId': appointment.recurrence.parentAppointmentId,
            date: { $gte: appointment.date },
            status: 'scheduled',
            userId: ownerUserId // Busca na conta do proprietário
          });
          
          for (const appt of futureAppointments) {
            appt.status = 'confirmed';
            await appt.save();
            futureConfirmations++;
          }
        } else {
          // This is a parent appointment, confirm all children
          const childAppointments = await Appointment.find({
            'recurrence.parentAppointmentId': appointment._id,
            status: 'scheduled',
            userId: ownerUserId // Busca na conta do proprietário
          });
          
          for (const appt of childAppointments) {
            appt.status = 'confirmed';
            await appt.save();
            futureConfirmations++;
          }
        }
        
        return res.status(200).json({
          status: 'success',
          data: { 
            appointment,
            futureConfirmations 
          },
          message: `Agendamento confirmado junto com ${futureConfirmations} ocorrências futuras`
        });
      }
  
      res.status(200).json({
        status: 'success',
        data: { appointment }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };

// Get appointments with filters
// Versão melhorada do método getAppointments
exports.getAppointments = async (req, res) => {
    try {
      // Se temos o ownerUserId do middleware, usamos ele; caso contrário, buscamos
      let ownerUserId = req.ownerUserId;
      
      if (!ownerUserId) {
        // Se não foi definido no middleware, calculamos
        if (req.user.role === 'professional') {
          // Se o usuário é um profissional, precisa ter um parentId ou um registro Profession
          console.log(`è professional`)
          ownerUserId = await getOwnerUserId(req)
        } else {
          // Se não é profissional, usa o próprio ID
          ownerUserId = req.user._id;
        }
      }
      
      console.log(ownerUserId)
      // Construir a query base com o userId do proprietário
      const query = { userId: ownerUserId };
      const { status, startDate, endDate, clientId, professionalId } = req.query;
  
      // Se o usuário for um profissional e não tem permissão para ver todos os dados,
      // filtra apenas seus próprios agendamentos
      if (req.user.role === 'professional') {
        // Usamos o professionalId do middleware se disponível
        if (req.professionalId) {
          // Verifica permissões
          const professional = await Professional.findById(req.professionalId);
          if (!professional || !professional.permissions || !professional.permissions.visualizarDados) {
            // Se não tem permissão para visualizar todos os dados, só vê os próprios
            query.professionalId = req.professionalId;
          } else if (professionalId) {
            // Se tem permissão e um filtro foi especificado, aplica o filtro
            query.professionalId = professionalId;
          }
        } else {
          // Tentamos buscar o profissional mais uma vez
          const professional = await Professional.findOne({ userAccountId: req.user._id });
          if (professional) {
            query.professionalId = professional._id;
          } else {
            console.error('Não foi possível determinar o professionalId');
            return res.status(403).json({
              status: 'error',
              message: 'Não foi possível determinar seu perfil profissional'
            });
          }
        }
      } else if (professionalId) {
        // Se não for profissional mas um filtro foi especificado, aplica o filtro
        query.professionalId = professionalId;
      }
  
      // Aplicar outros filtros
      if (status) query.status = status;
      if (clientId) query.clientId = clientId;
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }
  
      console.log('Query de busca de agendamentos:', JSON.stringify(query));
      
      const appointments = await Appointment.find(query)
        .populate('clientId', 'name phone email')
        .populate('professionalId', 'name')
        .populate('serviceId', 'name duration price')
        .sort({ date: 1 });
  
      // Para cada agendamento, verificar se está fora do horário de trabalho
      const appointmentsWithStatusInfo = await Promise.all(appointments.map(async (appt) => {
        let isOutsideHours = false;
        
        try {
          isOutsideHours = await Appointment.isOutsideWorkingHours(
            appt.professionalId._id,
            appt.date
          );
        } catch (error) {
          console.error('Erro ao verificar horário de trabalho:', error);
          // Se ocorrer erro, não interrompe, apenas marca como false
        }
        
        return {
          ...appt.toObject(),
          isOutsideWorkingHours: isOutsideHours
        };
      }));
  
      res.json({
        status: 'success',
        data: { appointments: appointmentsWithStatusInfo }
      });
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };

// Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
    try {
      const ownerUserId = await getOwnerUserId(req);
      const { id } = req.params;
      const { status } = req.body;
  
      const appointment = await Appointment.findOne({
        _id: id,
        userId: ownerUserId // Busca na conta do proprietário
      });
  
      if (!appointment) {
        return res.status(404).json({
          status: 'error',
          message: 'Agendamento não encontrado'
        });
      }
  
      if (!appointment.canTransitionTo(status)) {
        return res.status(400).json({
          status: 'error',
          message: 'Transição de status inválida'
        });
      }
  
      appointment.status = status;
      await appointment.save();
  
      res.json({
        status: 'success',
        data: { appointment }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };
  

// Get available time slots
exports.getAvailableSlots = async (req, res) => {
    try {
      const { professionalId, date, serviceId } = req.query;
  
      // Get professional details
      const professional = await Professional.findById(professionalId);
      if (!professional) {
        return res.status(404).json({
          status: 'error',
          message: 'Profissional não encontrado'
        });
      }
  
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({
          status: 'error',
          message: 'Serviço não encontrado'
        });
      }
  
      const queryDate = new Date(date);
      const dayOfWeek = queryDate.getDay();
      const dayName = getDayName(dayOfWeek);
  
      // Check if professional works on this day
      if (!professional.workingHours || !professional.workingHours[dayName] || 
          !professional.workingHours[dayName].start || !professional.workingHours[dayName].end) {
        return res.json({
          status: 'success',
          data: { slots: [] }
        });
      }
  
      // Generate all possible slots
      const slots = [];
      const startTime = professional.workingHours[dayName].start.split(':').map(Number);
      const endTime = professional.workingHours[dayName].end.split(':').map(Number);
      
      // Default slot duration to 15 minutes if not specified
      const slotDuration = 15;
  
      queryDate.setHours(startTime[0], startTime[1], 0, 0);
      const endDateTime = new Date(queryDate);
      endDateTime.setHours(endTime[0], endTime[1], 0, 0);
  
      while (queryDate < endDateTime) {
        try {
          const availability = await checkAvailability(professionalId, queryDate, service.duration);
          
          // Add the slot with information if it's inside or outside of working hours
          slots.push({
            time: new Date(queryDate),
            available: availability.isAvailable,
            isOutsideWorkingHours: availability.isOutsideHours,
            isOverride: availability.isOverride
          });
        } catch (error) {
          // Slot not available, add with unavailable status
          slots.push({
            time: new Date(queryDate),
            available: false,
            error: error.message
          });
        }
        queryDate.setMinutes(queryDate.getMinutes() + slotDuration);
      }
  
      res.json({
        status: 'success',
        data: { slots }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  };


// Atualizar agendamento
exports.updateAppointment = async (req, res) => {
    try {
      const ownerUserId = await getOwnerUserId(req);
      const { id } = req.params;
      const updates = req.body;
      
      // Campos permitidos para atualização
      const allowedUpdates = [
        'date', 'notes', 'status', 'duration', 'color', 
        'sendReminder', 'clientId', 'professionalId', 'serviceId'
      ];
      
      // Filtrar apenas campos permitidos
      const updateData = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updateData[key] = updates[key];
        }
      });
      
      const appointment = await Appointment.findOne({
        _id: id,
        userId: ownerUserId // Busca na conta do proprietário
      });
      
      if (!appointment) {
        return res.status(404).json({
          status: 'error',
          message: 'Agendamento não encontrado'
        });
      }
      
      // Se estiver alterando data ou profissional ou serviço, verificar disponibilidade
      if (updateData.date || updateData.professionalId || updateData.serviceId) {
        const professionalId = updateData.professionalId || appointment.professionalId;
        
        let duration = appointment.duration;
        if (updateData.serviceId) {
          const service = await Service.findById(updateData.serviceId);
          if (!service) {
            return res.status(404).json({
              status: 'error',
              message: 'Serviço não encontrado'
            });
          }
          duration = service.duration;
        }
        
        const date = updateData.date ? new Date(updateData.date) : appointment.date;
        
        // Verifica conflitos de agendamento, ignorando o agendamento atual
        try {
                // Obter profissional
                const professional = await Professional.findById(professionalId);
                if (!professional) {
                    throw new Error('Professional not found');
                }

                const appointmentDate = new Date(date);
                const dayOfWeek = appointmentDate.getDay();
                const dayName = getDayName(dayOfWeek);
                
                // Verificar se profissional trabalha neste dia
                if (!professional.workingHours || !professional.workingHours[dayName] || 
                    !professional.workingHours[dayName].start || !professional.workingHours[dayName].end) {
                    throw new Error('Professional not working on this day');
                }

                // Verificar horário de trabalho
                const hours = appointmentDate.getHours().toString().padStart(2, '0');
                const minutes = appointmentDate.getMinutes().toString().padStart(2, '0');
                const timeString = `${hours}:${minutes}`;
                
                const startTime = professional.workingHours[dayName].start;
                const endTime = professional.workingHours[dayName].end;

                const isOutsideHours = timeString < startTime || timeString > endTime;
                if (isOutsideHours && !appointment.isOverride) {
                    throw new Error('Time outside working hours');
                }

                // Calcular hora de término
                const endTimeDate = new Date(appointmentDate.getTime() + (duration * 60000));

                // Obter todos os agendamentos do dia EXCETO o atual
                const dayStart = new Date(appointmentDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(appointmentDate);
                dayEnd.setHours(23, 59, 59, 999);

                const allAppointments = await Appointment.find({
                    professionalId,
                    _id: { $ne: appointment._id }, // Ignorar o próprio agendamento
                    date: { $gte: dayStart, $lte: dayEnd },
                    status: { $in: ['scheduled', 'confirmed'] }
                });

                // Verificar conflitos manualmente
                const appointmentStartTime = appointmentDate.getTime();
                const appointmentEndTime = endTimeDate.getTime();
                
                const conflictingAppointment = allAppointments.find(apt => {
                    const aptStartTime = apt.date.getTime();
                    const aptEndTime = aptStartTime + (apt.duration * 60000);
                    
                    return (appointmentStartTime < aptEndTime && appointmentEndTime > aptStartTime);
                });

                if (conflictingAppointment && !appointment.isOverride) {
                    throw new Error('Time slot conflicts with existing appointment');
                }

                // Atualizar flag de encaixe se necessário
                updateData.isOverride = conflictingAppointment ? true : isOutsideHours;
                
            } catch (error) {
                if (!appointment.isOverride) {
                  return res.status(400).json({
                    status: 'error',
                    message: error.message
                  });
                }
              }
            }
            
            // Atualizar agendamento
            Object.keys(updateData).forEach(key => {
              appointment[key] = updateData[key];
            });
            
            await appointment.save();
            
            // Atualizar agendamentos recorrentes, se solicitado
            const updateAllFuture = req.query.updateAllFuture === 'true';
        
        if (updateAllFuture && appointment.recurrence && appointment.recurrence.isRecurring) {
            let futureUpdates = 0;
            
            const updateKey = updateData.date ? 'date' : null;
            let dateDiff = null;
            
            if (updateKey === 'date') {
                const oldDate = new Date(appointment._doc.date);
                const newDate = new Date(updateData.date);
                dateDiff = newDate.getTime() - oldDate.getTime();
            }
            
            // Atualizar agendamentos futuros
            const query = {
                userId: req.user._id,
                status: { $nin: ['cancelled', 'completed'] }
            };
            
            if (appointment.recurrence.parentAppointmentId) {
                // Este é um agendamento filho, atualizar todos a partir deste
                query['recurrence.parentAppointmentId'] = appointment.recurrence.parentAppointmentId;
                query.date = { $gt: appointment.date };
            } else {
                // Este é um agendamento pai, atualizar todos os filhos
                query['recurrence.parentAppointmentId'] = appointment._id;
            }
            
            const futureAppointments = await Appointment.find(query);
            
            for (const appt of futureAppointments) {
                if (updateKey === 'date' && dateDiff) {
                    // Ajustar data mantendo o mesmo deslocamento
                    const currentDate = new Date(appt.date);
                    currentDate.setTime(currentDate.getTime() + dateDiff);
                    appt.date = currentDate;
                }
                
                // Copiar outros campos atualizados (exceto data que já foi tratada)
                Object.keys(updateData).forEach(key => {
                    if (key !== 'date') {
                        appt[key] = updateData[key];
                    }
                });
                
                await appt.save();
                futureUpdates++;
            }
            
            return res.json({
                status: 'success',
                data: { 
                    appointment,
                    futureUpdates
                },
                message: `Appointment updated along with ${futureUpdates} future occurrences`
            });
        }
        
        res.json({
            status: 'success',
            data: { appointment }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};