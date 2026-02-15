export const StartMode = Object.freeze({
    START: "start",
    RANDOM: "random",
    MIX: "mix"
});

export const DEFAULT_SETTINGS = Object.freeze({
    temperature: 1.0,
    startMode: StartMode.START,
    randomStartProb: 0.25
});

const settingsMap = new Map();

export function getSettings(chatId) {
    const s = settingsMap.get(chatId);
    return s ? { ...DEFAULT_SETTINGS, ...s } : { ...DEFAULT_SETTINGS };
}

export function setTemperature(chatId, temperature) {
    const s = getSettings(chatId);
    s.temperature = temperature;
    settingsMap.set(chatId, s);
}

export function setStartMode(chatId, mode) {
    const s = getSettings(chatId);
    s.startMode = mode;
    settingsMap.set(chatId, s);
}

export function setRandomStartProb(chatId, prob) {
    const s = getSettings(chatId);
    s.randomStartProb = prob;
    settingsMap.set(chatId, s);
}

export function formatSettings(chatId) {
    const s = getSettings(chatId);
    return `temperature=${s.temperature} | startMode=${s.startMode} | randomStartProb=${s.randomStartProb}`;
}
