export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.openvpm.com";

export const demoUrl =
  process.env.NEXT_PUBLIC_DEMO_URL ?? "https://demo.openvpm.com";

export const appLoginUrl = `${appUrl}/login`;
export const cloudSignupUrl = `${appUrl}/register?intent=cloud`;
export const demoLoginUrl = `${demoUrl}/login`;
