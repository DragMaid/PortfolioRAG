
# RetrievalResultDto


## Properties

Name | Type
------------ | -------------
`authorName` | string
`queries` | Array&lt;string&gt;
`passages` | [Array&lt;RetrievedPassageDto&gt;](RetrievedPassageDto.md)

## Example

```typescript
import type { RetrievalResultDto } from ''

// TODO: Update the object below with actual values
const example = {
  "authorName": null,
  "queries": null,
  "passages": null,
} satisfies RetrievalResultDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RetrievalResultDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


