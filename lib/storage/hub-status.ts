export type HubConnectionStatus = "browser" | "connecting" | "online" | "offline-cache" | "authentication-required" | "conflict" | "error"
export type HubStatusListener = (status: HubConnectionStatus) => void
