import cron from "node-cron"

export function startJobs() {
	const task = cron.schedule(
		"* * * * *",
		() => {
			const ts = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
			console.log(`[CRON] ${ts} - Halo dari cron job 👍`)
		},
		{
			scheduled: true,
			timezone: "Asia/Jakarta"
		}
	)

	return { task }
}