/**
 * Script de diagnóstico para verificar la configuración de Stripe Price IDs
 * 
 * Uso: node check-stripe-config.js
 */

const markets = ['us', 'es', 'mx'];
const plans = ['starter', 'growth', 'agency'];
const intervals = ['monthly', 'annual'];

console.log('🔍 Verificando configuración de Stripe Price IDs...\n');

let missingCount = 0;
let foundCount = 0;
const missing = [];

// Check subscription prices
console.log('📋 SUBSCRIPTION PLANS:');
console.log('━'.repeat(80));

for (const market of markets) {
    console.log(`\n${market.toUpperCase()} Market:`);
    for (const plan of plans) {
        for (const interval of intervals) {
            const envVarName = `STRIPE_PRICE_${plan.toUpperCase()}_${market.toUpperCase()}_${interval.toUpperCase()}`;
            const value = process.env[envVarName];
            
            if (value) {
                console.log(`  ✅ ${envVarName}=${value}`);
                foundCount++;
            } else {
                console.log(`  ❌ ${envVarName} - MISSING`);
                missing.push(envVarName);
                missingCount++;
            }
        }
    }
}

// Check token packages
console.log('\n\n💰 TOKEN PACKAGES:');
console.log('━'.repeat(80));

const tokenAmounts = ['100', '300', '600', '1200', '3000', '6000'];
for (const market of markets) {
    console.log(`\n${market.toUpperCase()} Market:`);
    for (const amount of tokenAmounts) {
        const envVarName = `STRIPE_PRICE_${amount}TK_${market.toUpperCase()}`;
        const value = process.env[envVarName];
        
        if (value) {
            console.log(`  ✅ ${envVarName}=${value}`);
            foundCount++;
        } else {
            console.log(`  ❌ ${envVarName} - MISSING`);
            missing.push(envVarName);
            missingCount++;
        }
    }
}

// Check legacy prices
console.log('\n\n🔄 LEGACY PRICES (Fallback):');
console.log('━'.repeat(80));

const legacyPlans = ['starter', 'growth', 'agency'];
for (const plan of legacyPlans) {
    const envVarName = `STRIPE_PRICE_${plan.toUpperCase()}`;
    const value = process.env[envVarName];
    
    if (value) {
        console.log(`  ℹ️  ${envVarName}=${value}`);
    } else {
        console.log(`  ⚠️  ${envVarName} - Not set`);
    }
}

const legacyTokens = ['100', '300', '600', '1200', '3000', '6000'];
for (const amount of legacyTokens) {
    const envVarName = `STRIPE_PRICE_${amount}TK`;
    const value = process.env[envVarName];
    
    if (value) {
        console.log(`  ℹ️  ${envVarName}=${value}`);
    } else {
        console.log(`  ⚠️  ${envVarName} - Not set`);
    }
}

// Summary
console.log('\n\n📊 RESUMEN:');
console.log('━'.repeat(80));
console.log(`✅ Configurados: ${foundCount}`);
console.log(`❌ Faltantes: ${missingCount}`);

if (missingCount > 0) {
    console.log('\n⚠️  ATENCIÓN: Hay price IDs faltantes. El sistema usará legacy prices como fallback.');
    console.log('\nVariables faltantes:');
    missing.forEach(varName => {
        console.log(`  - ${varName}`);
    });
    console.log('\n📖 Ver BILLING_MULTI_MARKET_FIX.md para más información.');
} else {
    console.log('\n✅ Todos los price IDs están configurados correctamente!');
}

console.log('\n');
