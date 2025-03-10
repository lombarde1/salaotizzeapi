// fix-barcode-index.js - versão corrigida
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://darkvips:lombarde1@147.79.111.143:27017/salaopro';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    authSource: 'admin'
}).then(async () => {
    console.log('Conectado ao MongoDB');
    
    try {
        // Obter a coleção products
        const collection = mongoose.connection.db.collection('products');
        
        // Remover o índice userId_1_barcode_1
        await collection.dropIndex('userId_1_barcode_1');
        console.log('Índice barcode removido com sucesso');
        
        // Recriar o índice sem sparse, usando apenas partialFilterExpression
        await collection.createIndex(
            { userId: 1, barcode: 1 }, 
            { 
                unique: true,
                sparse: true
            }
        );
        
        console.log('Índice barcode recriado com sucesso');
        
        // Listar índices após a correção
        console.log('Índices após a correção:');
        const indexesAfter = await collection.indexes();
        console.log(indexesAfter);
        
        console.log('Processo de correção concluído com sucesso');
    } catch (error) {
        console.error('Erro ao corrigir índices:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Desconectado do MongoDB');
    }
});