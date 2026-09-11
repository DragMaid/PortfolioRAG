
# MediaDto


## Properties

Name | Type
------------ | -------------
`id` | number
`filename` | string
`url` | string
`extension` | [MediaExtension](MediaExtension.md)
`role` | [MediaRole](MediaRole.md)
`caption` | string
`byteSize` | number
`postId` | number
`createdAt` | Date

## Example

```typescript
import type { MediaDto } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "filename": null,
  "url": null,
  "extension": null,
  "role": null,
  "caption": null,
  "byteSize": null,
  "postId": null,
  "createdAt": null,
} satisfies MediaDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MediaDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


