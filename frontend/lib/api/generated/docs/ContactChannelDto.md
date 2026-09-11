
# ContactChannelDto


## Properties

Name | Type
------------ | -------------
`id` | number
`authorId` | number
`label` | string
`url` | string
`handle` | string
`sortOrder` | number

## Example

```typescript
import type { ContactChannelDto } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "authorId": null,
  "label": null,
  "url": null,
  "handle": null,
  "sortOrder": null,
} satisfies ContactChannelDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ContactChannelDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


