# AdminPostsApi

All URIs are relative to *http://localhost:5009*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adminPostsCreate**](AdminPostsApi.md#adminpostscreate) | **POST** /api/admin/posts |  |
| [**adminPostsDelete**](AdminPostsApi.md#adminpostsdelete) | **DELETE** /api/admin/posts/{id} |  |
| [**adminPostsGetAll**](AdminPostsApi.md#adminpostsgetall) | **GET** /api/admin/posts |  |
| [**adminPostsGetById**](AdminPostsApi.md#adminpostsgetbyid) | **GET** /api/admin/posts/{id} |  |
| [**adminPostsPublish**](AdminPostsApi.md#adminpostspublish) | **POST** /api/admin/posts/{id}/publish |  |
| [**adminPostsUnpublish**](AdminPostsApi.md#adminpostsunpublish) | **POST** /api/admin/posts/{id}/unpublish |  |
| [**adminPostsUpdate**](AdminPostsApi.md#adminpostsupdate) | **PUT** /api/admin/posts/{id} |  |



## adminPostsCreate

> PostDto adminPostsCreate(createPostDto)



### Example

```ts
import {
  Configuration,
  AdminPostsApi,
} from '';
import type { AdminPostsCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminPostsApi(config);

  const body = {
    // CreatePostDto
    createPostDto: ...,
  } satisfies AdminPostsCreateRequest;

  try {
    const data = await api.adminPostsCreate(body);
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
| **createPostDto** | [CreatePostDto](CreatePostDto.md) |  | |

### Return type

[**PostDto**](PostDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |
| **403** |  |  -  |
| **404** |  |  -  |
| **409** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## adminPostsDelete

> adminPostsDelete(id)



### Example

```ts
import {
  Configuration,
  AdminPostsApi,
} from '';
import type { AdminPostsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminPostsApi(config);

  const body = {
    // number
    id: 56,
  } satisfies AdminPostsDeleteRequest;

  try {
    const data = await api.adminPostsDelete(body);
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


## adminPostsGetAll

> PagedResultOfPostSummaryDto adminPostsGetAll(search, authorId, isDraft, sort, page, pageSize, skip)



### Example

```ts
import {
  Configuration,
  AdminPostsApi,
} from '';
import type { AdminPostsGetAllRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminPostsApi(config);

  const body = {
    // string (optional)
    search: search_example,
    // number (optional)
    authorId: 56,
    // boolean (optional)
    isDraft: true,
    // PostSortOrder (optional)
    sort: ...,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
    // number (optional)
    skip: 56,
  } satisfies AdminPostsGetAllRequest;

  try {
    const data = await api.adminPostsGetAll(body);
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
| **search** | `string` |  | [Optional] [Defaults to `undefined`] |
| **authorId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isDraft** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **sort** | `PostSortOrder` |  | [Optional] [Defaults to `undefined`] [Enum: Newest, Oldest, MostViewed, Title] |
| **page** | `number` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `undefined`] |
| **skip** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**PagedResultOfPostSummaryDto**](PagedResultOfPostSummaryDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## adminPostsGetById

> PostDto adminPostsGetById(id)



### Example

```ts
import {
  Configuration,
  AdminPostsApi,
} from '';
import type { AdminPostsGetByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminPostsApi(config);

  const body = {
    // number
    id: 56,
  } satisfies AdminPostsGetByIdRequest;

  try {
    const data = await api.adminPostsGetById(body);
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

[**PostDto**](PostDto.md)

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


## adminPostsPublish

> PostDto adminPostsPublish(id)



### Example

```ts
import {
  Configuration,
  AdminPostsApi,
} from '';
import type { AdminPostsPublishRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminPostsApi(config);

  const body = {
    // number
    id: 56,
  } satisfies AdminPostsPublishRequest;

  try {
    const data = await api.adminPostsPublish(body);
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

[**PostDto**](PostDto.md)

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


## adminPostsUnpublish

> PostDto adminPostsUnpublish(id)



### Example

```ts
import {
  Configuration,
  AdminPostsApi,
} from '';
import type { AdminPostsUnpublishRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminPostsApi(config);

  const body = {
    // number
    id: 56,
  } satisfies AdminPostsUnpublishRequest;

  try {
    const data = await api.adminPostsUnpublish(body);
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

[**PostDto**](PostDto.md)

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


## adminPostsUpdate

> PostDto adminPostsUpdate(id, updatePostDto)



### Example

```ts
import {
  Configuration,
  AdminPostsApi,
} from '';
import type { AdminPostsUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminPostsApi(config);

  const body = {
    // number
    id: 56,
    // UpdatePostDto
    updatePostDto: ...,
  } satisfies AdminPostsUpdateRequest;

  try {
    const data = await api.adminPostsUpdate(body);
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
| **updatePostDto** | [UpdatePostDto](UpdatePostDto.md) |  | |

### Return type

[**PostDto**](PostDto.md)

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
| **409** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

