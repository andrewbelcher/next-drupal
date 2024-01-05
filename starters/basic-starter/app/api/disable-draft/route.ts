import { cookies, draftMode } from "next/headers"

export async function GET(request: Request) {
  cookies().delete("draftData")
  draftMode().disable()

  // const draftModeCookie = cookies().get("__prerender_bypass")!
  // cookies().set({
  //   name: "__prerender_bypass",
  //   value: draftModeCookie?.value,
  //   expires: new Date(0), // Set expiration date to the past
  //   httpOnly: true,
  //   path: "/",
  //   secure: true,
  //   sameSite: "none",
  // })

  return new Response("Draft mode is disabled")
}
