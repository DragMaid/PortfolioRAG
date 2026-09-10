
# ReferrerDto


## Properties

Name | Type
------------ | -------------
`host` | string
`uniqueVisitors` | number
`reads` | number
`share` | number
`avgDwellSeconds` | number

## Example

```typescript
import type { ReferrerDto } from ''

// TODO: Update the object below with actual values
const example = {
  "host": null,
  "uniqueVisitors": null,
  "reads": null,
  "share": null,
  "avgDwellSeconds": null,
} satisfies ReferrerDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReferrerDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


