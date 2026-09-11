# MediaApi

All URIs are relative to *http://localhost:5099*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mediaGetContent**](MediaApi.md#mediagetcontent) | **GET** /api/media/{id}/content |  |



## mediaGetContent

> mediaGetContent(id)



### Example

```ts
import {
  Configuration,
  MediaApi,
} from '';
import type { MediaGetContentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MediaApi();

  const body = {
    // number
    id: 56,
  } satisfies MediaGetContentRequest;

  try {
    const data = await api.mediaGetContent(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `number` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **302** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

