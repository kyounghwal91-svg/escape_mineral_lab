/**
 * 오디오 에셋 매니페스트
 * 실제 파일 위치: public/sounds/
 *
 * ──────────────────────────────────────────────────────────────
 * 파일명 목록 (총 30개)
 *
 * [BGM - 5개]
 *   bgm_intro.mp3          IntroScene 타이틀 배경음 (루프)
 *   bgm_equipment.mp3      EquipmentScene 준비실 배경음 (루프)
 *   bgm_lab.mp3            LabScene 실험실 탐색 배경음 (루프)
 *   bgm_door.mp3           DoorScene 탈출 긴박 배경음 (루프)
 *   bgm_result.mp3         ResultScene 공통 결과 배경음 (1회)
 *
 * [SFX - UI 5개]
 *   sfx_btn_click.mp3      버튼 클릭
 *   sfx_btn_hover.mp3      버튼 호버
 *   sfx_popup_open.mp3     팝업(실험/노트/로그북/경도비교) 열림
 *   sfx_popup_close.mp3    팝업 닫힘
 *   sfx_monitor_on.mp3     EquipmentScene 모니터 CRT 켜짐 연출
 *
 * [SFX - 장비 착용 3개]
 *   sfx_equip_success.mp3  드래그 → 슬롯 착용 성공 (딸깍)
 *   sfx_equip_fail.mp3     드래그 → 슬롯 미스 (스냅백)
 *   sfx_equip_complete.mp3 3가지 보호구 모두 착용 완료 (팡파레)
 *
 * [SFX - 광물 조작 2개]
 *   sfx_mineral_pickup.mp3 광물 집어들기 (드래그 시작)
 *   sfx_mineral_drop.mp3   광물 내려놓기 (드롭 완료)
 *
 * [SFX - 조흔색 실험 1개]
 *   sfx_scratch.mp3        광물로 조흔판 긁기 (드래그 중 반복)
 *
 * [SFX - 염산 실험 3개]
 *   sfx_acid_drop.mp3      스포이드 드래그 → 페트리 접시 투하
 *   sfx_acid_bubble.mp3    염산 반응 거품 발생 (루프 or 1회)
 *   sfx_acid_none.mp3      염산 무반응 (조용한 챙 소리)
 *
 * [SFX - 자성 실험 2개]
 *   sfx_magnet_attract.mp3 클립이 광물에 달라붙을 때
 *   sfx_magnet_none.mp3    자성 무반응 (둔한 소리)
 *
 * [SFX - DoorScene 3개]
 *   sfx_door_unlock.mp3    열쇠 광물 끼워 넣기 성공
 *   sfx_door_open.mp3      문이 열릴 때 (탈출 직전)
 *   sfx_door_locked.mp3    잠금 해제 미완료 상태에서 문 클릭
 *
 * [SFX - 결과 3개]
 *   sfx_result_perfect.mp3 완벽한 탈출 (환호/팡파레)
 *   sfx_result_barely.mp3  겨우 탈출 (안도 + 긴장)
 *   sfx_result_failure.mp3 실패 (어두운 효과음)
 *
 * [SFX - 상태 3개]
 *   sfx_damage.mp3         HP 피해 발생
 *   sfx_timer_warning.mp3  남은 시간 60초 이하 경고
 *   sfx_dialogue.mp3       모니터 대사 타이핑 효과
 * ──────────────────────────────────────────────────────────────
 */

export const AUDIO_MANIFEST = {
  bgm: {
    intro:     { src: '/sounds/bgm_intro.mp3',     loop: true,  volume: 0.5 },
    equipment: { src: '/sounds/bgm_equipment.mp3', loop: true,  volume: 0.4 },
    lab:       { src: '/sounds/bgm_lab.mp3',       loop: true,  volume: 0.28 },
    door:      { src: '/sounds/bgm_door.mp3',      loop: true,  volume: 0.55 },
    result:    { src: '/sounds/bgm_result.mp3',    loop: false, volume: 0.6 },
  },
  sfx: {
    // ── UI ──────────────────────────────────────────────────
    btn_click:        { src: '/sounds/sfx_btn_click.mp3',        volume: 0.8  },
    btn_hover:        { src: '/sounds/sfx_btn_hover.mp3',        volume: 0.4  },
    popup_open:       { src: '/sounds/sfx_popup_open.mp3',       volume: 0.7  },
    popup_close:      { src: '/sounds/sfx_popup_close.mp3',      volume: 0.6  },
    monitor_on:       { src: '/sounds/sfx_monitor_on.mp3',       volume: 0.75 },

    // ── 장비 착용 (EquipmentScene) ──────────────────────────
    equip_success:    { src: '/sounds/sfx_equip_success.mp3',    volume: 0.85 },
    equip_fail:       { src: '/sounds/sfx_equip_fail.mp3',       volume: 0.6  },
    equip_complete:   { src: '/sounds/sfx_equip_complete.mp3',   volume: 1.0  },

    // ── 광물 조작 (LabScene 드래그) ─────────────────────────
    mineral_pickup:   { src: '/sounds/sfx_mineral_pickup.mp3',   volume: 0.7  },
    mineral_drop:     { src: '/sounds/sfx_mineral_drop.mp3',     volume: 0.65 },

    // ── 조흔색 실험 (ScratchEffect) ─────────────────────────
    scratch:          { src: '/sounds/sfx_scratch.mp3',          volume: 0.09 },

    // ── 염산 실험 (AcidEffect) ──────────────────────────────
    acid_drop:        { src: '/sounds/sfx_acid_drop.mp3',        volume: 1.0  },
    acid_bubble:      { src: '/sounds/sfx_acid_bubble.mp3',      volume: 1.0  },
    acid_none:        { src: '/sounds/sfx_acid_none.mp3',        volume: 0.9  },

    // ── 자성 실험 (MagnetEffect) ────────────────────────────
    magnet_attract:   { src: '/sounds/sfx_magnet_attract.mp3',   volume: 0.8  },
    magnet_none:      { src: '/sounds/sfx_magnet_none.mp3',      volume: 0.55 },

    // ── DoorScene ───────────────────────────────────────────
    door_unlock:      { src: '/sounds/sfx_door_unlock.mp3',      volume: 0.9  },
    door_open:        { src: '/sounds/sfx_door_open.mp3',        volume: 1.0  },
    door_locked:      { src: '/sounds/sfx_door_locked.mp3',      volume: 0.7  },

    // ── 결과 (ResultScene) ──────────────────────────────────
    result_perfect:   { src: '/sounds/sfx_result_perfect.mp3',   volume: 1.0  },
    result_barely:    { src: '/sounds/sfx_result_barely.mp3',    volume: 0.9  },
    result_failure:   { src: '/sounds/sfx_result_failure.mp3',   volume: 0.95 },

    // ── 상태 ────────────────────────────────────────────────
    damage:           { src: '/sounds/sfx_damage.mp3',           volume: 0.9  },
    timer_warning:    { src: '/sounds/sfx_timer_warning.mp3',    volume: 0.8  },
    dialogue:         { src: '/sounds/sfx_dialogue.mp3',         volume: 0.65 },
  },
};
