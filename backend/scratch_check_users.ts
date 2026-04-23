import 'dotenv/config';
import prisma from './lib/prisma.js';

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true }
        });
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error("Query failed:", err);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
