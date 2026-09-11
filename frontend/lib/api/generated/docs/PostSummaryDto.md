
# PostSummaryDto


## Properties

Name | Type
------------ | -------------
`id` | number
`title` | string
`slug` | string
`summary` | string
`isDraft` | boolean
`isFeatured` | boolean
`author` | [AuthorSummaryDto](AuthorSummaryDto.md)
`viewCount` | number
`createdAt` | Date
`publishedAt` | Date
`category` | string
`domain` | string
`repoUrl` | string
`demoUrl` | string
`specUrl` | string
`thumbnail` | [MediaDto](MediaDto.md)
`trailer` | [MediaDto](MediaDto.md)

## Example

```typescript
import type { PostSummaryDto } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "slug": null,
  "summary": null,
  "isDraft": null,
  "isFeatured": null,
  "author": null,
  "viewCount": null,
  "createdAt": null,
  "publishedAt": null,
  "category": null,
  "domain": null,
  "repoUrl": null,
  "demoUrl": null,
  "specUrl": null,
  "thumbnail": null,
  "trailer": null,
} satisfies PostSummaryDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostSummaryDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


