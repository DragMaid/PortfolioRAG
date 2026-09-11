
# PagedResultOfPostSummaryDto


## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;PostSummaryDto&gt;](PostSummaryDto.md)
`page` | number
`pageSize` | number
`totalItems` | number
`totalPages` | number
`hasPrevious` | boolean
`hasNext` | boolean

## Example

```typescript
import type { PagedResultOfPostSummaryDto } from ''

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "page": null,
  "pageSize": null,
  "totalItems": null,
  "totalPages": null,
  "hasPrevious": null,
  "hasNext": null,
} satisfies PagedResultOfPostSummaryDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PagedResultOfPostSummaryDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


