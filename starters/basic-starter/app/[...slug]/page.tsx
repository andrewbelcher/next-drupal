import { cookies, draftMode } from "next/headers"
import { notFound } from "next/navigation"
import { Article } from "@/components/drupal/Article"
import { BasicPage } from "@/components/drupal/BasicPage"
import { drupal } from "@/lib/drupal"
import type { ResolvingMetadata } from "next"
import type { DrupalNode, JsonApiParams } from "next-drupal"

async function getNode(slug) {
  const path = slug.join("/")

  const params: JsonApiParams = {}

  const isDraftMode = draftMode().isEnabled
  let draftData = {}
  if (isDraftMode && cookies().has("draftData")) {
    draftData = JSON.parse(cookies().get("draftData")?.value || "{}")
  }
  console.log("getNode", { draftData })

  if (draftData.slug === path) {
    params.resourceVersion = draftData.resourceVersion
  }

  // Translating the path also allows us to discover the entity type.
  const translatedPath = await drupal.translatePath(path)

  if (!translatedPath) {
    throw new Error("Resource not found", { cause: "NotFound" })
  }

  const type = translatedPath?.jsonapi?.resourceName
  const uuid = translatedPath.entity.uuid

  if (type === "node--article") {
    params.include = "field_image,uid"
  }

  const resource = await drupal.getResource<DrupalNode>(type as string, uuid, {
    params,
  })

  if (!resource) {
    throw new Error(
      `Failed to fetch resource: ${translatedPath?.jsonapi?.individual}`,
      {
        cause: "DrupalError",
      }
    )
  }

  return resource
}

type NodePageProps = {
  params: { slug: string[] }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
  { params: { slug } }: NodePageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  let node
  try {
    node = await getNode(slug)
  } catch (e) {
    // If we fail to fetch the node, don't return any metadata.
    return {}
  }

  return {
    title: node.title,
  }
}

const RESOURCE_TYPES = ["node--page", "node--article"]

export async function generateStaticParams() {
  // TODO: Replace getStaticPathsFromContext() usage since there is no context.
  const paths = await drupal.getStaticPathsFromContext(RESOURCE_TYPES, {})
  console.log(
    "generateStaticParams",
    paths.map(({ params }) => params)
  )
  return paths.map(({ params }) => params)
}

export default async function NodePage({
  params: { slug },
  searchParams,
}: NodePageProps) {
  const isDraftMode = draftMode().isEnabled

  let node
  try {
    node = await getNode(slug)
  } catch (error) {
    // If getNode throws a NotFound error, tell Next.js the path is 404.
    if (error.cause === "NotFound") {
      notFound()
    }

    return null
  }

  // If we're not in draft mode and the resource is not published, return a 404.
  if (!isDraftMode && node?.status === false) {
    notFound()
  }

  return (
    <>
      {node.type === "node--page" && <BasicPage node={node} />}
      {node.type === "node--article" && <Article node={node} />}
    </>
  )
}
