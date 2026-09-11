# ContactChannelsApi

All URIs are relative to *http://localhost:5099*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**contactChannelsCreate**](ContactChannelsApi.md#contactchannelscreate) | **POST** /api/contact-channels |  |
| [**contactChannelsDelete**](ContactChannelsApi.md#contactchannelsdelete) | **DELETE** /api/contact-channels/{id} |  |
| [**contactChannelsGetAll**](ContactChannelsApi.md#contactchannelsgetall) | **GET** /api/contact-channels |  |
| [**contactChannelsUpdate**](ContactChannelsApi.md#contactchannelsupdate) | **PUT** /api/contact-channels/{id} |  |



## contactChannelsCreate

> ContactChannelDto contactChannelsCreate(contactChannelInputDto)



### Example

```ts
import {
  Configuration,
  ContactChannelsApi,
} from '';
import type { ContactChannelsCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContactChannelsApi(config);

  const body = {
    // ContactChannelInputDto
    contactChannelInputDto: ...,
  } satisfies ContactChannelsCreateRequest;

  try {
    const data = await api.contactChannelsCreate(body);
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
| **contactChannelInputDto** | [ContactChannelInputDto](ContactChannelInputDto.md) |  | |

### Return type

[**ContactChannelDto**](ContactChannelDto.md)

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

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## contactChannelsDelete

> contactChannelsDelete(id)



### Example

```ts
import {
  Configuration,
  ContactChannelsApi,
} from '';
import type { ContactChannelsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContactChannelsApi(config);

  const body = {
    // number
    id: 56,
  } satisfies ContactChannelsDeleteRequest;

  try {
    const data = await api.contactChannelsDelete(body);
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


## contactChannelsGetAll

> Array&lt;ContactChannelDto&gt; contactChannelsGetAll(authorId)



### Example

```ts
import {
  Configuration,
  ContactChannelsApi,
} from '';
import type { ContactChannelsGetAllRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContactChannelsApi();

  const body = {
    // number (optional)
    authorId: 56,
  } satisfies ContactChannelsGetAllRequest;

  try {
    const data = await api.contactChannelsGetAll(body);
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
| **authorId** | `number` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;ContactChannelDto&gt;**](ContactChannelDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## contactChannelsUpdate

> ContactChannelDto contactChannelsUpdate(id, contactChannelInputDto)



### Example

```ts
import {
  Configuration,
  ContactChannelsApi,
} from '';
import type { ContactChannelsUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContactChannelsApi(config);

  const body = {
    // number
    id: 56,
    // ContactChannelInputDto
    contactChannelInputDto: ...,
  } satisfies ContactChannelsUpdateRequest;

  try {
    const data = await api.contactChannelsUpdate(body);
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
| **contactChannelInputDto** | [ContactChannelInputDto](ContactChannelInputDto.md) |  | |

### Return type

[**ContactChannelDto**](ContactChannelDto.md)

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

