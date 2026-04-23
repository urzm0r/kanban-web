import 'dotenv/config';
import prisma from './lib/prisma.js';

async function main() {
    const boards = await prisma.board.findMany({ include: { _count: { select: { members: true } } } });
    console.log("Boards:", boards.map(b => ({ id: b.id, title: b.title })));
    
    if (boards.length > 0) {
        const boardToDelete = boards[0];
        if (!boardToDelete) return;
        console.log("Attempting to delete board:", boardToDelete.id);
        try {
            await prisma.board.delete({ where: { id: boardToDelete.id } });
            console.log("Deleted successfully!");
        } catch (e) {
            console.error("Error deleting:", e);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
