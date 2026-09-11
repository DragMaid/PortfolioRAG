
# TopPostDto


## Properties

Name | Type
------------ | -------------
`postId` | number
`title` | string
`slug` | string
`summary` | string
`reads` | number
`share` | number

## Example

```typescript
import type { TopPostDto } from ''

// TODO: Update the object below with actual values
const example = {
  "postId": null,
  "title": null,
  "slug": null,
  "summary": null,
  "reads": null,
  "share": null,
} satisfies TopPostDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TopPostDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


