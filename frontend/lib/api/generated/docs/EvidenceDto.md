
# EvidenceDto


## Properties

Name | Type
------------ | -------------
`documentId` | number
`sourceType` | [RagSourceType](RagSourceType.md)
`sourceLabel` | string
`quote` | string

## Example

```typescript
import type { EvidenceDto } from ''

// TODO: Update the object below with actual values
const example = {
  "documentId": null,
  "sourceType": null,
  "sourceLabel": null,
  "quote": null,
} satisfies EvidenceDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as EvidenceDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


