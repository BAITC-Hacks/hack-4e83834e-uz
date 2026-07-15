import { createContext, useContext, useMemo, useState } from "react";

// Simple lang toggle - ru default (primary audience), en secondary. See
// /README.md's RU localization note. UI copy lives here; per-value labels
// (defect types, statuses, districts, score-breakdown factors) live next to
// their English source of truth in constants.js as { en, ru } pairs, since
// those are also used as API filter values and shouldn't be duplicated.
const STRINGS = {
  en: {
    brand: "RoadWatch",
    brand_sub: "repair prioritization",
    nav_queue: "Queue",
    nav_map: "Map",
    nav_analytics: "Analytics",
    nav_submit: "Submit a report",

    queue_title: "Repair priority queue",
    queue_subtitle:
      "Ranked by the learned priority model (severity + traffic + repeat reports). Nothing here is scheduled until a human analyst approves it.",
    loading: "Loading…",
    no_defects_match: "No defects match these filters.",
    priority: "priority",

    map_title: "Defect map",
    map_subtitle: "Pin size reflects priority score; color reflects review status.",

    analytics_title: "Analytics",
    analytics_subtitle: "City-wide view of defect volume, mix, and the human review workflow.",
    stat_total: "Total defects",
    stat_open: "Open",
    stat_scheduled: "Scheduled",
    stat_rejected: "Rejected",
    stat_deferred: "Deferred",
    chart_by_type_title: "Defects by type",
    chart_by_type_caption: "Count of open + reviewed defects per defect class.",
    chart_by_district_title: "Defects by district",
    chart_by_district_caption: "Count of defects per Almaty district (illustrative demo geography).",
    chart_trend_title: "Defects reported over time",
    chart_trend_caption: "New defects created per day.",
    chart_funnel_title: "Human review outcomes",
    chart_funnel_caption: "How analysts have resolved reviewed defects so far.",

    submit_title: "Report a road defect",
    submit_subtitle:
      "Citizen submission form. Upload a photo of a pothole or crack near you - RoadWatch will detect it automatically and add it to the analyst's review queue. (Broken curb / faded marking detection is planned but not trained yet - see the model card.)",
    submit_segment_label: "Road segment / nearest street",
    submit_photo_label: "Photo",
    submit_note_label: "Note (optional)",
    submit_note_placeholder: "Anything else worth mentioning?",
    submit_button: "Submit report",
    submit_button_busy: "Submitting…",
    submit_failed: "Submission failed - please try again.",
    submit_next_title: "What happens next",
    submit_next_body:
      "RoadWatch runs the same YOLOv8 detector used for inspection photos. If a defect is found, it's either added as a brand-new item in the analyst queue, or - if it matches an existing open report at this location - counted as a repeat report, which raises its priority. Your photo never causes a repair crew to be dispatched automatically; a human analyst always makes that call.",

    filter_all_types: "All defect types",
    filter_all_districts: "All districts",
    filter_status_open: "Open (needs review)",
    filter_status_scheduled: "Scheduled",
    filter_status_rejected: "Rejected",
    filter_status_deferred: "Deferred",

    detection_model_line: "Detection model",
    confidence: "confidence",
    area_of_frame: "area of frame",
    priority_score_label: "Priority score",
    human_review: "Human review",
    decision_log: "Decision log",

    review_name_label: "Reviewer name (required)",
    review_name_placeholder: "e.g. A. Zhaksybekov",
    review_comment_label: "Comment (optional)",
    review_name_required: "Reviewer name is required before you can approve, reject, or defer.",
    review_failed: "Failed to submit review.",
    review_approve: "Approve",
    review_reject: "Reject",
    review_defer: "Defer",
    review_already_decided: "Already reviewed",
    review_already_decided_suffix: "No further action needed — the AI never re-decides once a human has ruled.",
    review_by: "by",

    vehicles_per_day: "vehicles/day",
    view_details: "View details",
  },
  ru: {
    brand: "RoadWatch",
    brand_sub: "приоритизация ремонта",
    nav_queue: "Очередь",
    nav_map: "Карта",
    nav_analytics: "Аналитика",
    nav_submit: "Сообщить о дефекте",

    queue_title: "Очередь приоритета ремонта",
    queue_subtitle:
      "Ранжировано обученной моделью приоритета (серьёзность + трафик + повторные обращения). Ничто здесь не запланировано, пока аналитик-человек не одобрит.",
    loading: "Загрузка…",
    no_defects_match: "Нет дефектов, соответствующих этим фильтрам.",
    priority: "приоритет",

    map_title: "Карта дефектов",
    map_subtitle: "Размер метки отражает приоритет; цвет — статус проверки.",

    analytics_title: "Аналитика",
    analytics_subtitle: "Общегородской обзор объёма дефектов, их типов и хода проверки человеком.",
    stat_total: "Всего дефектов",
    stat_open: "Открыто",
    stat_scheduled: "Запланировано",
    stat_rejected: "Отклонено",
    stat_deferred: "Отложено",
    chart_by_type_title: "Дефекты по типу",
    chart_by_type_caption: "Количество открытых и проверенных дефектов по классу.",
    chart_by_district_title: "Дефекты по району",
    chart_by_district_caption: "Количество дефектов по районам Алматы (иллюстративная демо-география).",
    chart_trend_title: "Дефекты во времени",
    chart_trend_caption: "Новые дефекты, созданные за день.",
    chart_funnel_title: "Итоги проверки человеком",
    chart_funnel_caption: "Как аналитики решали проверенные дефекты.",

    submit_title: "Сообщить о дефекте дороги",
    submit_subtitle:
      "Форма для жителей. Загрузите фото выбоины или трещины рядом с вами — RoadWatch автоматически распознает дефект и добавит его в очередь аналитика. (Распознавание бордюров и разметки в разработке — модель для них пока не обучена.)",
    submit_segment_label: "Участок дороги / ближайшая улица",
    submit_photo_label: "Фото",
    submit_note_label: "Комментарий (необязательно)",
    submit_note_placeholder: "Что-то ещё стоит упомянуть?",
    submit_button: "Отправить",
    submit_button_busy: "Отправка…",
    submit_failed: "Не удалось отправить - попробуйте ещё раз.",
    submit_next_title: "Что будет дальше",
    submit_next_body:
      "RoadWatch запускает тот же детектор YOLOv8, что используется для инспекционных фото. Если дефект найден, он либо добавляется как новый элемент в очередь аналитика, либо — если совпадает с уже открытым обращением на этом месте — засчитывается как повторное обращение, что повышает его приоритет. Ваше фото никогда не приводит к автоматической отправке ремонтной бригады; решение всегда принимает аналитик-человек.",

    filter_all_types: "Все типы дефектов",
    filter_all_districts: "Все районы",
    filter_status_open: "Открыт (требует проверки)",
    filter_status_scheduled: "Запланирован",
    filter_status_rejected: "Отклонён",
    filter_status_deferred: "Отложен",

    detection_model_line: "Модель детекции",
    confidence: "уверенность",
    area_of_frame: "площади кадра",
    priority_score_label: "Приоритет",
    human_review: "Проверка человеком",
    decision_log: "Журнал решений",

    review_name_label: "Имя проверяющего (обязательно)",
    review_name_placeholder: "например, А. Жаксыбеков",
    review_comment_label: "Комментарий (необязательно)",
    review_name_required: "Перед тем как одобрить, отклонить или отложить, укажите имя проверяющего.",
    review_failed: "Не удалось отправить решение.",
    review_approve: "Одобрить",
    review_reject: "Отклонить",
    review_defer: "Отложить",
    review_already_decided: "Уже проверено",
    review_already_decided_suffix: "Дальнейшие действия не нужны — ИИ никогда не пересматривает решение человека.",
    review_by: "—",

    vehicles_per_day: "автомобилей/день",
    view_details: "Подробнее",
  },
};

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState("ru");
  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key,
      pick: (labelPair) => labelPair?.[lang] ?? labelPair?.en ?? "",
    }),
    [lang]
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
