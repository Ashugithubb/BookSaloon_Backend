const prisma = require('./lib/prisma');

async function main() {
    try {
        console.log('Connecting to DB...');
        await prisma.$connect();
        console.log('Connected successfully!');

        const userCount = await prisma.user.count();
        console.log('User count:', userCount);

        await prisma.$disconnect();
    } catch (e) {
        console.error('Connection failed:', e);
        process.exit(1);
    }
}

main();
