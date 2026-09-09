
# PostDto


## Properties

Name | Type
------------ | -------------
`id` | number
`title` | string
`slug` | string
`summary` | string
`body` | string
`isDraft` | boolean
`author` | [AuthorSummaryDto](AuthorSummaryDto.md)
`viewCount` | number
`createdAt` | Date
`updatedAt` | Date
`publishedAt` | Date

## Example

```typescript
import type { PostDto } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "slug": null,
  "summary": null,
  "body": null,
  "isDraft": null,
  "author": null,
  "viewCount": null,
  "createdAt": null,
  "updatedAt": null,
  "publishedAt": null,
} satisfies PostDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PostDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


