import cron from "node-cron"
import { checkDeviceOff } from "../controllers/panel/notif.controller.js"

export function startJobs() {
	const task = cron.schedule(
		"* * * * *",
		() => {
			checkDeviceOff()
		},
		{
			scheduled: true,
			timezone: "Asia/Jakarta"
		}
	)

	return { task }
}