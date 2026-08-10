// Starting points for a widget built by hand (brief §29).
//
// Not empty shells. Someone who picks "Calculator" gets a working, priced,
// two-question widget they can immediately preview and publish — because the
// fastest way to teach this product is to hand somebody something that already
// works and let them change it.

import { widgetSchemaSchema, type WidgetDocument, type WidgetType } from "./schema";

export function blankWidget(type: WidgetType): WidgetDocument {
  switch (type) {
    case "quiz":
      return widgetSchemaSchema.parse({
        name: "Untitled quiz",
        type: "quiz",
        intro: {
          heading: "Find your match",
          description: "A couple of questions and we'll point you the right way.",
          buttonLabel: "Start",
          illustration: "sparkle",
        },
        steps: [
          {
            id: "priority",
            title: "What matters most to you?",
            input: {
              kind: "choice",
              columns: 3,
              options: [
                { id: "speed", label: "Speed", value: "speed", illustration: "rocket", scores: { quick: 3 } },
                { id: "price", label: "Price", value: "price", illustration: "coins", scores: { value: 3 } },
                { id: "quality", label: "Quality", value: "quality", illustration: "star", scores: { premium: 3 } },
              ],
            },
          },
          {
            id: "experience",
            title: "How much have you done this before?",
            input: {
              kind: "choice",
              columns: 3,
              options: [
                { id: "new", label: "First time", value: "new", illustration: "question", scores: { quick: 1 } },
                { id: "some", label: "A little", value: "some", illustration: "clock", scores: { value: 1 } },
                { id: "lots", label: "Plenty", value: "lots", illustration: "star", scores: { premium: 1 } },
              ],
            },
          },
        ],
        result: {
          kind: "recommendation",
          heading: "Your match",
          outcomes: [
            {
              id: "quick",
              title: "The quick option",
              description: "Least fuss, fastest result.",
              bullets: ["Up and running today"],
              illustration: "rocket",
            },
            {
              id: "value",
              title: "The value option",
              description: "The sensible middle.",
              bullets: ["Best price for what you get"],
              illustration: "coins",
            },
            {
              id: "premium",
              title: "The premium option",
              description: "Everything, done properly.",
              bullets: ["The full treatment"],
              illustration: "star",
            },
          ],
          cta: { label: "Get started" },
        },
      });

    case "estimator":
      return widgetSchemaSchema.parse({
        name: "Untitled estimate",
        type: "estimator",
        intro: {
          heading: "Get your estimate",
          description: "Two quick questions and you'll have a price.",
          buttonLabel: "Get my estimate",
          illustration: "coins",
        },
        steps: [
          {
            id: "size",
            title: "How big is the job?",
            input: {
              kind: "choice",
              columns: 3,
              options: [
                { id: "small", label: "Small", value: 150, illustration: "box" },
                { id: "medium", label: "Medium", value: 350, illustration: "house" },
                { id: "large", label: "Large", value: 700, illustration: "truck" },
              ],
            },
          },
          {
            id: "urgency",
            title: "When do you need it?",
            input: {
              kind: "choice",
              columns: 2,
              options: [
                { id: "flexible", label: "I'm flexible", value: 0, illustration: "calendar" },
                { id: "soon", label: "As soon as possible", value: 120, illustration: "clock" },
              ],
            },
          },
        ],
        result: {
          kind: "range",
          heading: "Your estimated price",
          expression: "total + size + urgency",
          rangeSpread: 0.2,
          bullets: ["No obligation", "Fixed price before we start"],
          cta: { label: "Book it in" },
          disclaimer: "This is an indicative estimate.",
        },
      });

    case "calculator":
    default:
      return widgetSchemaSchema.parse({
        name: "Untitled calculator",
        type: "calculator",
        intro: {
          heading: "Work out your number",
          description: "Two figures and we'll do the arithmetic.",
          buttonLabel: "Start",
          illustration: "chart",
        },
        steps: [
          {
            id: "quantity",
            title: "How many do you need?",
            input: { kind: "slider", min: 1, max: 50, step: 1, defaultValue: 10 },
          },
          {
            id: "rush",
            title: "Do you need it in a hurry?",
            required: false,
            input: { kind: "toggle", onLabel: "Yes", offLabel: "No", illustration: "clock" },
          },
        ],
        result: {
          kind: "value",
          heading: "Your total",
          expression: "total + quantity * 25 + rush * 50",
          bullets: ["Change any answer to see it update"],
          cta: { label: "Get in touch" },
        },
      });
  }
}

/** The three cards on the "New widget" screen (§29). */
export const START_POINTS: Array<{ type: WidgetType; label: string; blurb: string }> = [
  { type: "calculator", label: "Calculator", blurb: "Numbers in, a number out." },
  { type: "estimator", label: "Estimator", blurb: "Questions in, a price out." },
  { type: "quiz", label: "Quiz", blurb: "Questions in, a recommendation out." },
];
