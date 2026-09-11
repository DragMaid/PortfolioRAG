# PostsApi

All URIs are relative to *http://localhost:5009*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**postsGetBySlug**](PostsApi.md#postsgetbyslug) | **GET** /api/posts/{slug} |  |
| [**postsGetMedia**](PostsApi.md#postsgetmedia) | **GET** /api/posts/{slug}/media |  |
| [**postsGetPublished**](PostsApi.md#postsgetpublished) | **GET** /api/posts |  |
| [**postsRegisterView**](PostsApi.md#postsregisterview) | **POST** /api/posts/{slug}/views |  |



## postsGetBySlug

> PostDto postsGetBySlug(slug)



### Example

```ts
import {
  Configuration,
  PostsApi,
} from '';
import type { PostsGetBySlugRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PostsApi();

  const body = {
    // string
    slug: slug_example,
  } satisfies PostsGetBySlugRequest;

  try {
    const data = await api.postsGetBySlug(body);
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
| **slug** | `string` |  | [Defaults to `undefined`] |

### Return type

[**PostDto**](PostDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postsGetMedia

> Array&lt;MediaDto&gt; postsGetMedia(slug)



### Example

```ts
import {
  Configuration,
  PostsApi,
} from '';
import type { PostsGetMediaRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PostsApi();

  const body = {
    // string
    slug: slug_example,
  } satisfies PostsGetMediaRequest;

  try {
    const data = await api.postsGetMedia(body);
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
| **slug** | `string` |  | [Defaults to `undefined`] |

### Return type

[**Array&lt;MediaDto&gt;**](MediaDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postsGetPublished

> PagedResultOfPostSummaryDto postsGetPublished(search, authorId, isDraft, isFeatured, sort, page, pageSize, skip)



### Example

```ts
import {
  Configuration,
  PostsApi,
} from '';
import type { PostsGetPublishedRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PostsApi();

  const body = {
    // string (optional)
    search: search_example,
    // number (optional)
    authorId: 56,
    // boolean (optional)
    isDraft: true,
    // boolean (optional)
    isFeatured: true,
    // PostSortOrder (optional)
    sort: ...,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
    // number (optional)
    skip: 56,
  } satisfies PostsGetPublishedRequest;

  try {
    const data = await api.postsGetPublished(body);
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
| **isFeatured** | `boolean` |  | [Optional] [Defaults to `undefined`] |
| **sort** | `PostSortOrder` |  | [Optional] [Defaults to `undefined`] [Enum: Newest, Oldest, MostViewed, Title] |
| **page** | `number` |  | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `undefined`] |
| **skip** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**PagedResultOfPostSummaryDto**](PagedResultOfPostSummaryDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postsRegisterView

> postsRegisterView(slug)



### Example

```ts
import {
  Configuration,
  PostsApi,
} from '';
import type { PostsRegisterViewRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new PostsApi();

  const body = {
    // string
    slug: slug_example,
  } satisfies PostsRegisterViewRequest;

  try {
    const data = await api.postsRegisterView(body);
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
| **slug** | `string` |  | [Defaults to `undefined`] |

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
| **200** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

