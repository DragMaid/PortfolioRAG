
# MetricDto


## Properties

Name | Type
------------ | -------------
`value` | number
`previousValue` | number
`change` | number

## Example

```typescript
import type { MetricDto } from ''

// TODO: Update the object below with actual values
const example = {
  "value": null,
  "previousValue": null,
  "change": null,
} satisfies MetricDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MetricDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


