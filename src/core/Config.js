/**
 * config.txt 를 fetch 하여 파싱합니다.
 * 파일이 없거나 읽기 실패 시 기본값을 반환합니다.
 */

const DEFAULTS = {
  testMode:   false,
  startScene: 'intro',
  ending:     'failure',
};

const VALID_SCENES  = new Set(['intro', 'equipment', 'lab', 'result', 'door']);
const VALID_ENDINGS = new Set(['perfect', 'barely', 'failure']);

export async function loadConfig() {
  try {
    const res = await fetch('./config.txt');
    if (!res.ok) {
      console.warn('[Config] config.txt 를 불러오지 못했습니다. 기본값을 사용합니다.');
      return { ...DEFAULTS };
    }
    const text = await res.text();
    return parseConfig(text);
  } catch (e) {
    console.warn('[Config] config.txt 읽기 오류:', e);
    return { ...DEFAULTS };
  }
}

function parseConfig(text) {
  const cfg = { ...DEFAULTS };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key   = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    switch (key) {
      case 'testMode':
        cfg.testMode = (value === 'true');
        break;
      case 'startScene':
        if (VALID_SCENES.has(value)) {
          cfg.startScene = value;
        } else {
          console.warn(`[Config] 알 수 없는 startScene: "${value}" → 기본값 "intro" 사용`);
        }
        break;
      case 'ending':
        if (VALID_ENDINGS.has(value)) {
          cfg.ending = value;
        } else {
          console.warn(`[Config] 알 수 없는 ending: "${value}" → 기본값 "failure" 사용`);
        }
        break;
      default:
        console.warn(`[Config] 알 수 없는 키: "${key}" — 무시됩니다.`);
    }
  }

  return cfg;
}
