// route handler with secret and slug
import { cookies, draftMode } from "next/headers"
import { redirect } from "next/navigation"
import { drupal } from "@/lib/drupal"
import type { NextRequest } from "next/server"

export async function handler(request: NextRequest) {
  // Parse query string parameters
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get("slug")

  console.log("api/draft GET:", { searchParams })

  // Fetch the headless CMS to check if the provided `slug` exists
  const validation = await validateUrl(searchParams)

  // If the slug doesn't exist prevent draft mode from being enabled
  if (validation.status !== 200) {
    console.error(
      `Could not validate slug: [${validation.status}] ${validation.error}`
    )
    return new Response("Could not validate slug.", { status: 401 })
  }

  // Enable Draft Mode by setting the cookie
  draftMode().enable()

  // See https://vercel.com/docs/workflow-collaboration/draft-mode
  const draftModeCookieName = "__prerender_bypass"
  // Override the default SameSite=lax.
  // See https://github.com/vercel/next.js/issues/49927
  const draftModeCookie = cookies().get(draftModeCookieName)!
  cookies().set({
    name: draftModeCookieName,
    value: draftModeCookie?.value,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
  })

  // Send Drupal's data to the draft-mode page.
  cookies().set(
    "draftData",
    JSON.stringify(Object.fromEntries(searchParams.entries()))
  )

  console.log("draft/route:GET", { validation })
  // Redirect to the path from the fetched post
  // We can safely redirect to the slug since this has been validated on the server.
  redirect(slug as string)
}

// @TODO Move a refactored validateUrl back into next-drupal since this is
//   common code between draft and preview modes.
async function validateUrl(searchParams: URLSearchParams) {
  const validation = {
    status: 200,
    error: "",
  }

  console.log("validateUrl", {
    slug: searchParams.get("slug"),
    resourceVersion: searchParams.get("resourceVersion"),
    plugin: searchParams.get("plugin"),
    searchParams,
  })

  let result
  try {
    // Validate the draft url.
    const validateUrl = drupal.buildUrl("/next/preview-url").toString()
    result = await drupal.fetch(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(Object.fromEntries(searchParams.entries())),
    })
  } catch (e) {
    return {
      ...validation,
      status: 422,
    }
  }

  if (!result.ok) {
    return {
      ...validation,
      error: (await result.text()) || "",
      status: result.status,
    }
  }

  // The result includes the scope.
  const validationPayload = (await result.json()) as object
  console.log("validatePreviewUrl", {
    validationPayload,
  })

  return validation
}

export { handler as GET, handler as POST }
