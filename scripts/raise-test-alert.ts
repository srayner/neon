// Opens or resolves a test C1 (Container down) alert through the alert engine,
// so the scheduled check of a running Neon sends it to ntfy.
//
//   npx tsx scripts/raise-test-alert.ts open [server-name]
//   npx tsx scripts/raise-test-alert.ts resolve [server-name]
//
// The subject is a made-up service, "neon-test-alert", on the named server
// (default: the first server by id).
import { prisma } from '../lib/prisma';
import { openAlert, resolveAlert, type AlertSubject } from '../lib/alerts/engine';

const SERVICE = 'neon-test-alert';

async function main() {
  const [action, serverName] = process.argv.slice(2);
  if (action !== 'open' && action !== 'resolve') {
    console.error('Usage: npx tsx scripts/raise-test-alert.ts open|resolve [server-name]');
    process.exit(2);
  }

  const server = serverName
    ? await prisma.server.findUnique({ where: { name: serverName } })
    : await prisma.server.findFirst({ orderBy: { id: 'asc' } });
  if (!server) {
    console.error(serverName ? `No server named "${serverName}".` : 'No servers in the database.');
    process.exit(1);
  }

  const subject: AlertSubject = { serverId: server.id, key: SERVICE, entityType: 'service' };
  const at = new Date();

  if (action === 'open') {
    const alert = await openAlert({
      code: 'C1',
      subject,
      message: `${SERVICE} on ${server.name} down (test alert)`,
      at,
    });
    console.log(alert ? `Opened C1 #${alert.id} on ${server.name}.` : 'C1 is already open for it.');
  } else {
    const alert = await resolveAlert({ code: 'C1', subject, at });
    console.log(alert ? `Resolved C1 #${alert.id} on ${server.name}.` : 'No open C1 for it.');
  }
  console.log('The running Neon sends it within 30 seconds.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
