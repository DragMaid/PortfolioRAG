# PostMediaApi

All URIs are relative to *http://localhost:5099*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**postMediaDelete**](PostMediaApi.md#postmediadelete) | **DELETE** /api/admin/posts/{postId}/media/{mediaId} |  |
| [**postMediaGetAll**](PostMediaApi.md#postmediagetall) | **GET** /api/admin/posts/{postId}/media |  |
| [**postMediaUpdate**](PostMediaApi.md#postmediaupdate) | **PUT** /api/admin/posts/{postId}/media/{mediaId} |  |
| [**postMediaUpload**](PostMediaApi.md#postmediaupload) | **POST** /api/admin/posts/{postId}/media |  |



## postMediaDelete

> postMediaDelete(postId, mediaId)



### Example

```ts
import {
  Configuration,
  PostMediaApi,
} from '';
import type { PostMediaDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PostMediaApi(config);

  const body = {
    // number
    postId: 56,
    // number
    mediaId: 56,
  } satisfies PostMediaDeleteRequest;

  try {
    const data = await api.postMediaDelete(body);
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
| **postId** | `number` |  | [Defaults to `undefined`] |
| **mediaId** | `number` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postMediaGetAll

> Array&lt;MediaDto&gt; postMediaGetAll(postId)



### Example

```ts
import {
  Configuration,
  PostMediaApi,
} from '';
import type { PostMediaGetAllRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PostMediaApi(config);

  const body = {
    // number
    postId: 56,
  } satisfies PostMediaGetAllRequest;

  try {
    const data = await api.postMediaGetAll(body);
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
| **postId** | `number` |  | [Defaults to `undefined`] |

### Return type

[**Array&lt;MediaDto&gt;**](MediaDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postMediaUpdate

> MediaDto postMediaUpdate(postId, mediaId, updateMediaDto)



### Example

```ts
import {
  Configuration,
  PostMediaApi,
} from '';
import type { PostMediaUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PostMediaApi(config);

  const body = {
    // number
    postId: 56,
    // number
    mediaId: 56,
    // UpdateMediaDto
    updateMediaDto: ...,
  } satisfies PostMediaUpdateRequest;

  try {
    const data = await api.postMediaUpdate(body);
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
| **postId** | `number` |  | [Defaults to `undefined`] |
| **mediaId** | `number` |  | [Defaults to `undefined`] |
| **updateMediaDto** | [UpdateMediaDto](UpdateMediaDto.md) |  | |

### Return type

[**MediaDto**](MediaDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postMediaUpload

> MediaDto postMediaUpload(postId, file)



### Example

```ts
import {
  Configuration,
  PostMediaApi,
} from '';
import type { PostMediaUploadRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PostMediaApi(config);

  const body = {
    // number
    postId: 56,
    // Blob (optional)
    file: BINARY_DATA_HERE,
  } satisfies PostMediaUploadRequest;

  try {
    const data = await api.postMediaUpload(body);
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
| **postId** | `number` |  | [Defaults to `undefined`] |
| **file** | `Blob` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**MediaDto**](MediaDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |
| **413** |  |  -  |
| **415** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

