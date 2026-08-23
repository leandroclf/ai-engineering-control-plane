import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("aicp-locale")?.value;
  const locale = cookieLocale === "pt-BR" || cookieLocale === "pt-PT" ? cookieLocale : "en";
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
