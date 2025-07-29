import i18next from 'i18next';

const resources = {
  'en-US': {
    translation: {
      email: {
        welcome: {
          subject: 'Welcome to HyperAgency — Your Agentic AI Platform',
          text: `Hi {{userName}},

Welcome to HyperAgency — the self-developing, agentic AI platform designed to help you automate everything, evolve faster, and focus on what truly matters.

With HyperAgency, you can:
- Build and run **agentic AI systems** that evolve your product, business, or infrastructure.
- Program agents using **plain language prompts**, no coding required.
- Deploy agents that improve themselves or automate your daily workflows.
- Connect to any APIs, UI, databases, etc.
- Take control of your stack with **autonomous orchestration**.
- Export, control, and document agent behavior human-in-the-loop supervision.

Start now:
{{link}}

Need help? Have ideas? Reply to this email — we’d love to hear how HyperAgency can better serve your vision.

Thank you for joining the future of self-developing systems.

Let’s build something extraordinary,
The HyperAgency Team
`
        },
      },
    },
  },
  'ru-RU': {
    translation: {
      email: {
        welcome: {
          subject: 'Добро пожаловать в HyperAgency — вашу агентную AI-платформу',
          text: `Привет, {{userName}}!

Добро пожаловать в HyperAgency — саморазвивающуюся агентную AI-платформу, созданную для того, чтобы помочь вам автоматизировать всё, развиваться быстрее и сосредоточиться на действительно важном.

С помощью HyperAgency вы можете:
- Создавать и запускать **агентные AI-системы**, которые развивают ваш продукт, бизнес или инфраструктуру.
- Программировать агентов с помощью **простых текстовых команд**, без необходимости писать код.
- Развёртывать агентов, которые улучшают себя сами или автоматизируют ваши ежедневные процессы.
- Подключаться к любым API, пользовательским интерфейсам, базам данных и др.
- Управлять своим стеком с помощью **автономной оркестрации**.
- Экспортировать, контролировать и документировать поведение агентов с участием человека в процессе.

Начните сейчас:
{{link}}

Нужна помощь? Есть идеи? Ответьте на это письмо — мы будем рады узнать, как HyperAgency может лучше реализовать ваше видение.

Спасибо, что присоединились к будущему саморазвивающихся систем.

Давайте создадим что-то выдающееся,
Команда HyperAgency
`
        },
      },
    },
  },
};

i18next.init({
  resources,
  lng: 'en-US', // default language
  fallbackLng: 'en-US',
  debug: true,
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;

export function userI18n({ user }) {
  const lng = user.settings.language || 'en-US';
  const ui18n = i18next.cloneInstance({ lng });
  return ui18n
}
