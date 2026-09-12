
# RagIndexStateDto


## Properties

Name | Type
------------ | -------------
`builtAt` | Date
`documentCount` | number
`error` | string
`pendingJob` | [RagJobDto](RagJobDto.md)

## Example

```typescript
import type { RagIndexStateDto } from ''

// TODO: Update the object below with actual values
const example = {
  "builtAt": null,
  "documentCount": null,
  "error": null,
  "pendingJob": null,
} satisfies RagIndexStateDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RagIndexStateDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


