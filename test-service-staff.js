// Test script to verify ServiceStaff table works
const prisma = require('./lib/prisma');

async function testServiceStaffTable() {
    try {
        console.log('🧪 Testing ServiceStaff table...');

        // Try to count records
        const count = await prisma.serviceStaff.count();
        console.log(`✅ ServiceStaff table exists! Current record count: ${count}`);

        // Try to find all records
        const records = await prisma.serviceStaff.findMany({
            include: {
                service: {
                    select: { name: true }
                },
                staff: {
                    select: { name: true }
                }
            }
        });

        console.log(`\n📋 Current ServiceStaff records:`);
        records.forEach(record => {
            console.log(`  - Service: ${record.service.name} → Staff: ${record.staff.name}`);
        });

        if (records.length === 0) {
            console.log('  ⚠️  No records found in ServiceStaff table');
        }

    } catch (error) {
        console.error('❌ Error testing ServiceStaff table:', error.message);
        console.error('Full error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testServiceStaffTable();
