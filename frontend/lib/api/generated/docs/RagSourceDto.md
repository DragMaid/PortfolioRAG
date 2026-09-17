
# RagSourceDto


## Properties

Name | Type
------------ | -------------
`sourceType` | [RagSourceType](RagSourceType.md)
`sourceId` | number
`label` | string
`status` | [RagSourceStatus](RagSourceStatus.md)
`error` | string
`passageCount` | number
`queuedAt` | Date
`indexedAt` | Date

## Example

```typescript
import type { RagSourceDto } from ''

// TODO: Update the object below with actual values
const example = {
  "sourceType": null,
  "sourceId": null,
  "label": null,
  "status": null,
  "error": null,
  "passageCount": null,
  "queuedAt": null,
  "indexedAt": null,
} satisfies RagSourceDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RagSourceDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


