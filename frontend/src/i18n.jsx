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

    landing_title: "AI-assisted road defect detection & repair prioritization",
    landing_lead:
      "RoadWatch detects road defects automatically and ranks them using traffic volume, defect severity, and repeat reports. Repairs are never dispatched automatically — an authorized human analyst always inspects and decides.",
    landing_citizen_title: "I'm a citizen — report a road defect",
    landing_citizen_desc:
      "Upload a photo of a pothole or crack near you. RoadWatch will detect it and add it to the city's repair queue. Sign in quickly using SMS verification.",
    landing_citizen_btn: "Continue with Phone",
    landing_admin_title: "Analyst / Admin login",
    landing_admin_desc:
      "Access the prioritized review queue, inspect AI detection explanations and geo-segments, and schedule maintenance crews.",
    landing_email_label: "Analyst email",
    landing_password_label: "Password",
    landing_login_btn: "Sign in as Analyst",
    landing_login_busy: "Signing in…",
    phone_enter_number: "Phone number",
    phone_number_placeholder: "+7 701 555 0101",
    phone_send_code: "Send SMS code",
    phone_sending_code: "Sending SMS…",
    phone_enter_code: "Confirmation code",
    phone_code_placeholder: "6-digit code",
    phone_verify_btn: "Verify & proceed to report",
    phone_verifying: "Verifying…",
    phone_change_number: "Change phone number",
    auth_not_analyst: "This account is not registered as an analyst",
    nav_sign_out: "Sign out",
    auth_loading: "Checking authorization…",

    hero_eyebrow: "AI FOR SAFER ROADS",
    hero_heading_1: "automated road defect detection & ",
    hero_heading_highlight: "repair prioritization with AI.",
    hero_desc:
      "RoadWatch analyzes road surfaces, detects potholes and cracks, evaluates their severity and traffic volume on the segment. Nothing is dispatched automatically \u2014 the decision is always made by a human analyst.",
    hero_btn_citizen: "Report a road defect",
    hero_btn_admin: "Analyst / Admin login",
    hero_btn_start: "get started",
    hero_btn_how: "how it works",
    badge_public: "PUBLIC ACCESS",
    badge_staff: "STAFF ONLY",
    arch_eyebrow: "HOW IT WORKS",
    arch_title: "Four-stage prioritization pipeline",
    arch_subtitle:
      "From citizen defect report to municipal work order: AI detects and ranks, humans decide.",
    step1_title: "1. Photo upload",
    step1_desc:
      "Citizen smartphone photo submission or municipal road inspection with GPS coordinates.",
    step2_title: "2. Server-side YOLOv8",
    step2_desc:
      "Automatic detection of defect bounding boxes (pothole, crack) and physical damage area calculation.",
    step3_title: "3. Priority ranking",
    step3_desc:
      "Weighted scoring combining defect severity, road traffic volume, and repeat report clustering.",
    step4_title: "4. Human analyst review",
    step4_desc:
      "Human-in-the-loop: authorized municipal analyst inspects model explanations and approves repairs.",
    impact_title: "Transparent & Auditable Decisions",
    impact_desc:
      "Repairs are never dispatched automatically. Every approved or deferred order is recorded in an immutable audit log signed by a named analyst.",
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

    landing_title: "Распознавание дефектов дорог и приоритизация ремонта с помощью ИИ",
    landing_lead:
      "RoadWatch автоматически находит дорожные дефекты и ранжирует их с учётом интенсивности движения, степени повреждения и повторных обращений. Бригады никогда не отправляются автоматически — решение всегда принимает уполномоченный аналитик.",
    landing_citizen_title: "Я житель — сообщить о дефекте дороги",
    landing_citizen_desc:
      "Загрузите фото выбоины или трещины. RoadWatch распознает дефект и передаст его в очередь дорожных служб города. Быстрый вход по SMS-коду.",
    landing_citizen_btn: "Войти по номеру телефона",
    landing_admin_title: "Вход для аналитика / администратора",
    landing_admin_desc:
      "Доступ к очереди приоритизации дефектов, объяснениям детектора и карте участков, а также утверждение ремонтных нарядов.",
    landing_email_label: "Email аналитика",
    landing_password_label: "Пароль",
    landing_login_btn: "Войти как аналитик",
    landing_login_busy: "Вход…",
    phone_enter_number: "Номер телефона",
    phone_number_placeholder: "+7 701 555 0101",
    phone_send_code: "Получить SMS-код",
    phone_sending_code: "Отправка SMS…",
    phone_enter_code: "Код из SMS",
    phone_code_placeholder: "6-значный код",
    phone_verify_btn: "Подтвердить и перейти к отправке",
    phone_verifying: "Проверка…",
    phone_change_number: "Изменить номер",
    auth_not_analyst: "Этот аккаунт не зарегистрирован в списке аналитиков",
    nav_sign_out: "Выйти",
    auth_loading: "Проверка доступа…",

    hero_eyebrow: "ИИ ДЛЯ БЕЗОПАСНЫХ ДОРОГ",
    hero_heading_1: "автоматическое обнаружение дефектов дорог и ",
    hero_heading_highlight: "приоритизация ремонта с помощью ИИ.",
    hero_desc:
      "RoadWatch анализирует дорожные покрытия и выявляет выбоины и трещины, оценивает их серьёзность и интенсивность движения на участке. Ничего не отправляется автоматически — решение всегда принимает аналитик.",
    hero_btn_citizen: "Сообщить о дефекте",
    hero_btn_admin: "Вход для аналитика",
    hero_btn_start: "начать работу",
    hero_btn_how: "как это работает",
    badge_public: "ДОСТУП ДЛЯ ЖИТЕЛЕЙ",
    badge_staff: "ДЛЯ АНАЛИТИКОВ",
    arch_eyebrow: "КАК ЭТО РАБОТАЕТ",
    arch_title: "Четырёхэтапный конвейер приоритизации",
    arch_subtitle:
      "От фиксации дефекта жителем до наряда дорожной службы: модель ранжирует, человек утверждает.",
    step1_title: "1. Фотофиксация",
    step1_desc:
      "Загрузка фото гражданами через веб-форму или муниципальными инспекциями с фиксацией координат.",
    step2_title: "2. Серверный YOLOv8",
    step2_desc:
      "Выявление дефектов (выбоины, трещины) на сервере без необходимости локальной обработки.",
    step3_title: "3. Модель приоритета",
    step3_desc:
      "Ранжирование с учётом трафика участка, площади дефекта и повторных обращений граждан.",
    step4_title: "4. Решение аналитика",
    step4_desc:
      "Человек в контуре: сертифицированный аналитик проверяет объяснение ИИ и утверждает ремонт.",
    impact_title: "Прозрачность и контроль",
    impact_desc:
      "Никакой автоматической отправки бригад. Каждое решение сохраняется в неизменяемый журнал аудита с подписью аналитика.",
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
