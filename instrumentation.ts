// Next.js calls register() once when the server starts.
export async function register() {
  // The check uses Prisma, so it runs in the Node.js runtime only.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAlertCheck } = await import('./lib/alerts/check');
    startAlertCheck();
  }
}
