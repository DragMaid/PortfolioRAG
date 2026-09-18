
# CoverLetterDto


## Properties

Name | Type
------------ | -------------
`letter` | string
`roleTitle` | string
`company` | string
`sources` | [Array&lt;CoverLetterSourceDto&gt;](CoverLetterSourceDto.md)
`usage` | [UsageDto](UsageDto.md)

## Example

```typescript
import type { CoverLetterDto } from ''

// TODO: Update the object below with actual values
const example = {
  "letter": null,
  "roleTitle": null,
  "company": null,
  "sources": null,
  "usage": null,
} satisfies CoverLetterDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CoverLetterDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


