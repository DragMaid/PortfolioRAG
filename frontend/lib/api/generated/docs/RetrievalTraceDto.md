
# RetrievalTraceDto


## Properties

Name | Type
------------ | -------------
`queries` | Array&lt;string&gt;
`passagesConsidered` | number
`passagesCited` | number
`citationsRejected` | number

## Example

```typescript
import type { RetrievalTraceDto } from ''

// TODO: Update the object below with actual values
const example = {
  "queries": null,
  "passagesConsidered": null,
  "passagesCited": null,
  "citationsRejected": null,
} satisfies RetrievalTraceDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RetrievalTraceDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


