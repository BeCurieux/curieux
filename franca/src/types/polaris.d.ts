/**
 * Just enough typing for the Polaris web components and the App Bridge global
 * this app uses. Shopify publishes full types (@shopify/polaris-types,
 * @shopify/app-bridge-types); they are not added until the page grows past a
 * handful of components, because a types package pinned to the wrong Polaris
 * release describes components the page does not render.
 */

import type { DetailedHTMLProps, HTMLAttributes } from "react";

type PolarisElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [attribute: string]: unknown;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": PolarisElement;
      "s-section": PolarisElement;
      "s-stack": PolarisElement;
      "s-box": PolarisElement;
      "s-heading": PolarisElement;
      "s-paragraph": PolarisElement;
      "s-text": PolarisElement;
      "s-button": PolarisElement;
      "s-badge": PolarisElement;
      "s-banner": PolarisElement;
      "s-spinner": PolarisElement;
      "s-choice-list": PolarisElement;
      "s-choice": PolarisElement;
      "s-table": PolarisElement;
      "s-table-header-row": PolarisElement;
      "s-table-header": PolarisElement;
      "s-table-body": PolarisElement;
      "s-table-row": PolarisElement;
      "s-table-cell": PolarisElement;
      "s-link": PolarisElement;
    }
  }
}

declare global {
  /** Installed by app-bridge.js from the Shopify CDN. */
  var shopify: {
    idToken(): Promise<string>;
    toast: { show(message: string, options?: { isError?: boolean }): void };
  };
}

export {};
