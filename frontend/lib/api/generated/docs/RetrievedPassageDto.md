
# RetrievedPassageDto


## Properties

Name | Type
------------ | -------------
`documentId` | number
`sourceType` | [RagSourceType](RagSourceType.md)
`sourceLabel` | string
`chunkIndex` | number
`content` | string
`score` | number
`matchedQueries` | Array&lt;string&gt;

## Example

```typescript
import type { RetrievedPassageDto } from ''

// TODO: Update the object below with actual values
const example = {
  "documentId": null,
  "sourceType": null,
  "sourceLabel": null,
  "chunkIndex": null,
  "content": null,
  "score": null,
  "matchedQueries": null,
} satisfies RetrievedPassageDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RetrievedPassageDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


