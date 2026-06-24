项目仓库：[Space3044/Pixel-Space](https://github.com/Space3044/Pixel-Space)

本文是给 Vue、JavaScript 和 TypeScript 的小白看的，目的在于能读懂 Pixel Space 足迹页里的 `<script setup lang="ts">`、组件通信和响应式状态代码。

本文里面大部分代码都来自这些文件：

- `src/features/footprints/FootprintFlatMap.vue`
- `src/features/footprints/WorldBoundaryGlobe.vue`
- `src/features/footprints/footprint.ts`
- `src/features/footprints/marker-clustering.ts`
- `src/features/footprints/geo-hit.ts`

这里先简单掌握这篇里的基本概念，建立点阅读代码基础。

---

## 第一部分：先建立阅读入口

### TypeScript 到底加了什么

可以先把 TypeScript 理解成带类型提示的 JavaScript。

JavaScript 会这样写：

```js
const zoom = 3;
const name = '北京';
```

TypeScript 可以这样写：

```ts
const zoom: number = 3;
const name: string = '北京';
```

冒号后面的 `number` 和 `string` 就是类型。类型不会直接改变运行结果，它主要做三件事：

- 提前发现写错的代码。
- 让编辑器知道变量能用哪些属性和方法。
- 帮你读懂一个函数需要什么输入，会返回什么结果。

在项目里，你会经常看到这种写法：

```ts
const currentZoom = ref(zoomMin);
const expandedClusterId = ref<string | null>(null);
```

第一行没有写类型，因为 TS 能从 `zoomMin` 推出来。第二行写了 `<string | null>`，因为初始值是 `null`，但后面会变成字符串。这里如果不写，TS 可能只以为它永远是 `null`。

### 先读懂 Vue 的 script setup

Vue 文件里这行很重要：

```vue
<script setup lang="ts">
```

它表示这段脚本使用 Vue 的 `script setup` 写法，并启用 TypeScript。

普通 Vue 组件可能要写 `export default`。`script setup` 不需要。

`<script setup>` 里顶层声明的变量、函数和计算属性，会自动暴露给当前这个 `.vue` 文件的 `<template>` 使用。它们不会自动导出给其他组件。

```ts
const loading = ref(true);
const hoveredCountry = ref<string | null>(null);
```

在当前文件的 `<template>` 里可以直接写 `v-if="loading"` 或 `{{ hoveredCountry }}`。如果要让其他组件使用，需要通过 `props`、`emit` 或显式 `export` 来组织代码，后面会分别讲到。

## 第二部分：读懂 .ts 文件里的 JS/TS 语法

`.ts` 文件本质上还是 JavaScript，只是多了 TypeScript 的类型写法。读代码时先分两类：

```text
JS 写法：模块导入导出、基础符号、对象、函数调用、函数、表达式、解构、循环、数组方法、回调、异步、JSON、错误处理、this、作用域、闭包。
TS 写法：类型标注、组合类型、对象类型、泛型、类型推断和收窄、外部数据安全、工具类型、类型导入。
```

Vue 的组件、模板和响应式变量放到后面讲。这里先只看 JS/TS 语法本身。

### JS 常见写法

#### 模块 import 和 export

```ts
import { computed, ref } from 'vue';
import FootprintFlatMap from './FootprintFlatMap.vue';
import { groupFootprints } from './footprint';
```

`import` 表示从别的地方拿东西来用。读导入语句时，先看两边：

```text
from 左边：拿了什么。
from 右边：从哪里拿。
```

上面三句分别表示：

```text
从 vue 这个包里拿 computed、ref。
从 FootprintFlatMap.vue 里导入组件。
从当前目录的 footprint 文件里拿 groupFootprints。
```

有 `{}` 的是命名导入，名字要和对方 `export` 出来的名字对上。

```ts
import { groupFootprints } from './footprint';
```

没有 `{}` 的是默认导入，导入时可以自己起名字。Vue 组件常见这种写法。

```ts
import FootprintFlatMap from './FootprintFlatMap.vue';
```

`export` 表示把当前文件里的东西开放给别的文件使用。

```ts
export const groupFootprints = (images: ImageRecord[]): FootprintGroup[] => {
  // ...
};
```

这句表示：当前文件提供了一个叫 `groupFootprints` 的函数，其他文件可以用 `{ groupFootprints }` 导入它。

这里的 `export` 是跨文件共享，和 `<script setup>` 里变量能直接给当前模板使用不是一回事。

路径也要会读：

```text
'vue'：项目安装的包。
'./footprint'：当前文件旁边的 footprint 文件。
'@/shared/auth/useAdmin'：项目 src 目录下的文件。
```

#### JS 里容易误读的基础符号

```ts
if (source === 'china') {
  return domesticFootprints.value;
}
```

JS/TS 里判断相等常用 `===`。它表示值相等，并且类型也相同。

```ts
const visible = !loading.value && footprints.value.length > 0;
```

JS/TS 里的 `!` 表示取反，`&&` 表示并且，`||` 表示或者。

#### 对象和属性访问

```ts
const coordinate = { lat: footprint.lat, lng: footprint.lng };
activeFootprintKey.value;
```

`{}` 创建对象。`lat` 和 `lng` 是字段名，右边的 `footprint.lat`、`footprint.lng` 是字段值。点号 `.` 用来读取对象里的字段。

通用格式：

```ts
const 对象名 = { 字段名: 字段值 };
对象名.字段名;
```

在项目里，很多变量本质上都是对象。比如 `footprint` 不是一个普通字符串，它是一条足迹数据，里面有 `key`、`lat`、`lng`、`title` 等字段。所以代码里才会写：

```ts
footprint.key;
footprint.lat;
footprint.lng;
```

JS 对象常用点号读取字段，也就是 `footprint.key` 这种写法。

同一个字段也可以用方括号读取：

```ts
const value = footprint['key'];
```

#### 函数调用

```ts
const loading = ref(false);
const footprints = computed(() => groupFootprints(images.value));
const response = await fetch('/maps/world.zh.json');
```

看到名字后面有 `()`，就表示在调用函数。括号里放的是传给函数的参数。有些函数会返回结果，有些函数只是执行一个动作。

上面三句分别表示：

```text
ref(false)：调用 ref，把 false 作为初始值。
groupFootprints(images.value)：调用 groupFootprints，把图片数组传进去。
fetch('/maps/world.zh.json')：调用 fetch，请求地图 JSON 文件。
```

`对象.方法名()` 也是函数调用，只是这个函数挂在对象上。比如：

```ts
response.json();
footprint.name.trim();
Math.max(0, count);
```

这种写法的通用格式是：

```ts
函数名(参数一, 参数二);
对象.方法名(参数);
```

读函数调用时，先问三个问题：调用了谁，传了什么，返回什么。

#### 箭头函数

```ts
const selectFootprint = (footprint: FootprintGroup) => {
  activeFootprintKey.value = footprint.key;
};
```

这是一种函数写法。`=>` 左边是参数，右边是函数内容。这里表示：传进来一个 `footprint`，然后把它的 `key` 保存到 `activeFootprintKey.value`。

它等价于普通函数写法：

```ts
function selectFootprint(footprint: FootprintGroup) {
  activeFootprintKey.value = footprint.key;
}
```

通用格式：

```ts
const 函数名 = (参数名: 参数类型): 返回类型 => {
  函数内容;
};
```

箭头函数常见两种写法。带 `{}` 时，函数体里要自己写 `return`；不带 `{}` 时，右边表达式会直接作为返回值。

```ts
// 简写
const getKey = (footprint: FootprintGroup) => footprint.key;

// 展开写
const getKeyWithReturn = (footprint: FootprintGroup) => {
  return footprint.key;
};
```

#### 模板字符串和三元表达式

```ts
const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
const countLabel = count > 99 ? '99+' : String(count);
```

反引号里的 `${}` 可以插入变量或表达式。`条件 ? A : B` 是简短的 if/else：条件成立用 A，不成立用 B。

第一行最后得到的 `label` 就是字符串。它会把纬度和经度格式化成类似这样的内容：

```text
31.2304, 121.4737
```

通用格式：

```ts
`文字 ${变量或表达式}`
条件 ? 成立时的值 : 不成立时的值
```

字符串可以用单引号、双引号或反引号。项目里普通字符串多用单引号；需要把变量拼进字符串时，用反引号。

```ts
const city = '上海';
const label = `城市：${city}`;
```

#### 可选链和默认值

```ts
const key = footprint?.key;
const radius = options.radius ?? DEFAULT_CLUSTER_RADIUS;
```

`?.` 表示左边有值才继续读属性。`??` 表示左边是 `null` 或 `undefined` 时，改用右边的默认值。

通用格式：

```ts
可能为空的值?.属性名
可能为空的值 ?? 默认值
```

这两个经常一起出现，但含义不同。

```text
?. 是安全读取属性。
?? 是提供兜底默认值。
```

比如 `footprint?.key` 的意思是：如果 `footprint` 有值，就读取 `footprint.key`；如果 `footprint` 是 `null` 或 `undefined`，结果就是 `undefined`，不会报错。

`options.radius ?? DEFAULT_CLUSTER_RADIUS` 的意思是：如果 `options.radius` 有值，就用它；如果它是 `null` 或 `undefined`，就用默认半径。

#### 解构和展开

```ts
const [worldResponse, chinaResponse] = await Promise.all([fetch('/world.json'), fetch('/china.json')]);
const names = [...new Set(visitedPlaces)];
```

`[]` 左边这种写法是数组解构，用来按位置取值。`...` 是展开，把一组值摊开放进新数组。

数组解构看位置，对象解构看字段名。

```ts
const point = [121.47, 31.23];
const [lng, lat] = point;

const footprint = { key: 'shanghai', title: '上海' };
const { key, title } = footprint;
```

展开 `...` 常用于复制数组、合并数组、去重后再变回数组。

```ts
const allNames = [...domesticNames, ...worldNames];
const uniqueNames = [...new Set(allNames)];
```

通用格式：

```ts
const [变量一, 变量二] = 数组;
const { 字段名 } = 对象;
const 新数组 = [...旧数组];
```

#### for...of 和 for...in

```ts
for (const footprint of footprints.value) {
  console.log(footprint.title);
}
```

`for...of` 用来遍历一组数据里的“值”。上面这段表示：从 `footprints.value` 里一项一项取出足迹，每次取出的那一项叫 `footprint`。

通用格式：

```ts
for (const 当前项 of 数组或一组数据) {
  处理当前项;
}
```

如果只关心数组里的每一项，优先读成 `for...of`。

```ts
const names = ['上海', '杭州'];

for (const name of names) {
  console.log(name);
}
```

这里打印的是数组里的值：

```text
上海
杭州
```

`for...in` 读的是“键”或“下标”，不是值。

```ts
const names = ['上海', '杭州'];

for (const index in names) {
  console.log(index);
}
```

这里打印的是数组下标：

```text
0
1
```

所以这两个要分开记：

```text
for...of：遍历值。
for...in：遍历键或下标。
```

项目里遍历数组时，更多会看到 `for...of`、`map`、`filter`。`for...in` 更适合需要读取对象字段名的场景。

#### 数组方法和回调函数

```ts
footprints.value.filter((footprint) => footprint.region === 'china');
footprints.value.map((footprint) => ({ lat: footprint.lat, lng: footprint.lng }));
```

`filter` 和 `map` 会遍历数组。括号里的 `(footprint) => ...` 是回调函数，数组方法每拿到一项，就调用它一次。

这里不是箭头函数“自动把结果传给 map”。实际顺序是：

```text
map / filter 负责遍历数组
每遍历到一项，就把当前项交给括号里的函数
括号里的函数返回处理结果
map / filter 根据返回结果组成新数组
```

通用格式：

```ts
数组.filter((当前项) => 判断条件);          // 筛选
数组.map((当前项) => 转换后的新值);         // 转换
数组.find((当前项) => 判断条件);            // 找第一个
数组.reduce((累计结果, 当前项) => 新结果, 初始值); // 累计
```

数组方法负责遍历，括号里的函数负责处理每一项。箭头函数只是这个函数的写法。

#### 事件和回调

```ts
marker.addEventListener('click', () => emit('select', footprint));
```

`addEventListener` 是给元素绑定事件。第一项 `'click'` 表示点击事件，第二项 `() => emit('select', footprint)` 是回调函数。

这段代码不是立刻执行 `emit`。它的意思是：等用户点击 `marker` 时，再执行后面的回调函数。

```ts
元素.addEventListener('事件名', () => {
  事件发生后要做的事;
});
```

它和数组里的回调类似，都是“把函数交给别人”。区别在执行时机：

```text
数组方法的回调：遍历数组时执行。
事件回调：用户操作发生时执行。
```

项目里这句：

```ts
marker.addEventListener('click', () => emit('select', footprint));
```

可以读成：点击这个地图点时，子组件发出 `select（事件名）` 事件，并把当前 `footprint（数据）` 一起带给父组件。

#### 异步写法

```ts
const loadMapData = async () => {
  const response = await fetch('/world.json');
  const data = await response.json();
  return data;
};
```

判断是否需要 `async`，起点不是“这个函数会不会慢”，而是“里面有没有等待异步 API”。比如 `fetch` 是浏览器提供的异步 API，它不会立刻给你地图数据，而是先返回一个 `Promise<Response>`。

`await fetch('/world.json')` 会等这个 Promise 完成，然后拿到里面的 `Response`。因为函数里面用了 `await`，外层函数就要写 `async`。

通用格式：

```ts
const 函数名 = async () => {
  const 结果 = await 返回Promise的任务;
  return 处理后的结果;
};
```

同步函数不需要 `async`。比如只计算数组长度，这个结果已经在内存里，可以立刻得到。

```ts
const countPlaces = (places: string[]) => {
  return places.length;
};
```

常见需要 `await` 的场景：

```text
fetch 请求接口或静态文件。
response.json() 读取响应内容。
Promise.all([...]) 等多个异步任务一起完成。
动态 import() 加载模块或组件。
```

`Promise` 可以理解成“未来会有结果的对象”。它有三种状态：等待中、成功、失败。普通对象可以用 `对象.字段` 取值；Promise 的值还没准备好，所以要用 `await` 或 `.then()` 等它完成。

不要把 `async` 当成加速开关。JS 里浏览器 API 例如 `fetch()` 会返回 Promise；你的函数里要 `await` 它，外层才写 `async`。

#### JSON

```ts
const response = await fetch('/maps/world.zh.json');
const worldMap = await response.json();
```

JSON 是一种数据文本格式。项目里的地图边界、接口返回结果，经常会以 JSON 形式传回来。

`fetch()` 拿到的是响应对象 `Response`，不是最终数据。`response.json()` 会读取响应内容，把 JSON 文本解析成 JS 可以使用的对象或数组。

通用格式：

```ts
const response = await fetch('地址');
const data = await response.json();
```

注意 `response.json()` 本身也是异步的，所以前面也要写 `await`。读到这里时，可以按两步理解：

```text
fetch：把文件或接口响应拿回来。
response.json：把响应内容解析成数据。
```

#### try / catch

```ts
try {
  images.value = await loadFootprintImages();
} catch (error) {
  console.error(error);
}
```

`try / catch` 用来处理可能失败的代码。`try` 里放要执行的代码；如果里面出错，就跳到 `catch`。

通用格式：

```ts
try {
  可能失败的代码;
} catch (error) {
  失败后要做的事;
}
```

它常和异步请求一起出现，因为接口请求、地图文件加载、JSON 解析都可能失败。

读这类代码时，可以这样拆：

```text
try：正常流程。
catch：失败流程。
error：失败原因。
```

`catch` 不是修好错误，它只是让代码有机会记录错误、显示失败状态，或者给用户一个兜底结果。

#### 补充：this、作用域和闭包

这三个概念在 JS 里重要，但项目的 `<script setup>` 代码不常直接写 `this`。先知道它们在读代码时代表什么就够了。

`this` 表示“当前调用这个函数的对象”。在普通 Vue 组件里可能看到 `this.xxx`，但 `<script setup>` 里通常直接用变量和函数，不需要 `this`。

```ts
const marker = {
  title: '上海',
  getTitle() {
    return this.title;
  },
};
```

作用域表示变量能在哪里被访问。`{}` 里面声明的变量，通常只在这块代码里面能用。

```ts
if (activeFootprint.value) {
  const key = activeFootprint.value.key;
}
```

这里的 `key` 只属于这个 `if` 代码块。

闭包表示函数记住了外层作用域里的变量。

```ts
const createSelectHandler = (footprint: FootprintGroup) => {
  return () => emit('select', footprint);
};
```

里面返回的函数还能用到外层的 `footprint`。项目里的事件回调经常有这种写法，比如点击 marker 时还能拿到创建它时传进来的 `footprint`。

### TS 类型写法

TS 是在 JS 上加类型系统。JS 负责运行，TS 负责在写代码时检查类型。

读 TS 时先分清两件事：

```text
const / let / function / if / await：运行时真的会执行。
interface / type / import type / : string / <T>：给 TS 检查用，编译后会被去掉。
```

所以 TS 不是另一套运行语言。它主要是在 JS 旁边补充“这个值应该是什么形状”。

下面按大类看。粗体只是类里面的小项，不再当成独立标题。

#### 基础类型和组合类型

**类型标注**

```ts
const name: string = '上海';
let hoveredCountry: string | null = null;
```

冒号后面是类型。`name: string` 表示 `name` 应该是字符串。`string | null` 表示可以是字符串，也可以是 `null`。

通用格式：

```ts
const 变量名: 类型 = 值;
let 变量名: 类型A | 类型B | null = 值;
```

**联合类型**

```ts
let hoveredCountry: string | null = null;
let id: string | number | null = null;
```

竖线 `|` 叫联合类型，表示“可能是其中之一”。比如：

```ts
FootprintGroup | null
'china' | 'world'
```

`string | null` 表示可以是字符串，也可以是 `null`。`'china' | 'world'` 表示只能从这两个固定字符串里选一个。

联合类型的作用是把“可能出现的值”写清楚。TS 会根据这个类型提醒你：使用它之前，要考虑每一种可能。

#### 类型命名和复用

**type：给类型起名字**

```ts
type Coordinate = [number, number];
type Source = 'china' | 'world';
```

`type` 可以给一段类型起名字。这样后面看到 `Coordinate`，就知道它代表 `[number, number]`。

通用格式：

```ts
type 类型名 = 类型内容;
```

`type` 常用来给联合类型、元组、复杂组合类型起名字。

#### 数据结构：数组、元组和对象

**数组和元组**

```ts
const points: ProjectedFootprintMarker[] = [];
type Coordinate = [number, number];
```

`Type[]` 表示数组，数组里的每一项都是 `Type`。`[number, number]` 是元组，表示固定两个位置，两个位置都必须是数字。

通用格式：

```ts
元素类型[]
[第一个位置的类型, 第二个位置的类型]
```

`ProjectedFootprintMarker[]` 不是一个点，而是一组点。数组里的每一项才是一个 `ProjectedFootprintMarker`。

```ts
const marker: ProjectedFootprintMarker = {
  key: 'shanghai',
  lng: 121.47,
  lat: 31.23,
  imagesCount: 3,
};

const markers: ProjectedFootprintMarker[] = [marker];
```

元组更强调位置含义。比如地图坐标常见写法是 `[lng, lat]`，第一个位置是经度，第二个位置是纬度。

**对象类型**

```ts
interface ProjectedFootprintMarker {
  key: string;
  lng: number;
  lat: number;
  imagesCount: number;
}
```

`interface` 描述对象长什么样。这里表示一个 `ProjectedFootprintMarker` 必须有 `key`、`lng`、`lat`、`imagesCount` 这些字段。

通用格式：

```ts
interface 类型名 {
  字段名: 字段类型;
}
```

这里的 `interface` 更适合理解成“对象结构说明”。它不是页面界面，也不会在浏览器里运行。它告诉 TS：这个对象应该有哪些字段，每个字段是什么类型。

**可选属性**

```ts
interface MarkerClusterOptions {
  radius?: number;
}
```

`?` 写在字段名后面，表示这个字段可有可无。

这表示 `radius` 可以传，也可以不传。它通常会放在一个配置对象里，比如源码里的 `options` 参数：

```ts
export const clusterProjectedMarkers = (
  points: ProjectedFootprintMarker[],
  options: MarkerClusterOptions = {},
) => {
  const radius = options.radius ?? DEFAULT_CLUSTER_RADIUS;
};
```

`options.radius` 的意思是：读取这个配置对象里的 `radius` 字段。

通用格式：

```ts
interface 类型名 {
  可选字段名?: 字段类型;
}
```

可选属性和普通属性的区别是：普通属性必须有，可选属性可以没有。读到 `?:` 时，要同时看到两个意思：`?` 表示可选，冒号后面表示类型。

**interface 和 type 的区别**

```ts
interface ProjectedFootprintMarker {
  key: string;
  lng: number;
  lat: number;
}

type Coordinate = [number, number];
type Source = 'china' | 'world';
```

对象结构常用 `interface`；元组、联合类型、固定值组合常用 `type`。

`interface` 的设计重点是描述对象有哪些字段。比如 `ProjectedFootprintMarker` 有 `key`、`lng`、`lat`，这种“一个对象长什么样”的场景，用 `interface` 读起来最直观。

`type` 更像“给任意类型表达式起名字”。它不只限于对象，也可以给元组、联合类型、固定值组合起名字：

```ts
type Coordinate = [number, number];
type Source = 'china' | 'world';
```

这里如果用 `interface` 就不合适，因为 `[number, number]` 不是对象字段结构，`'china' | 'world'` 也不是对象字段结构。

它们都只存在于 TS 类型检查阶段，不会变成浏览器里运行的代码。

**字符串字面量类型**

先不要看业务含义，先看这个结构：

```ts
type Direction = 'left' | 'right';
```

这里的 `'left'` 和 `'right'` 不是普通赋值。它们写在类型位置，所以它们是类型。

为什么具体字符串也能当类型？因为类型本来就是在描述“允许出现哪些值”。

```text
string：允许任意字符串。
'left'：只允许 'left' 这一个字符串。
'left' | 'right'：只允许这两个字符串之一。
```

所以这不是“类型变成了值”，而是“这个类型窄到只允许某个具体值”。

回到项目里的写法：

```ts
source: 'china' | 'world';
kind: 'single' | 'cluster';
```

这里不是在给 `source` 赋值。因为它写在类型定义里，冒号后面仍然是在写类型。

所以 `source: 'china' | 'world'` 的意思是：以后真正创建对象时，`source` 这个字段的值只能是 `'china'` 或 `'world'`。

```ts
const marker = {
  source: 'china',
  kind: 'single',
};
```

上面这个对象里的 `source: 'china'` 才是在放真实值。前面的 `source: 'china' | 'world'` 是在规定类型。

通用格式：

```ts
字段名: '允许的具体字符串一' | '允许的具体字符串二';
```

这类写法常用于限制选项。比如地图来源只能是国内或世界，标记类型只能是单点或聚合点。好处是写错时 TS 会提示。

#### 泛型和 Promise<T>

**泛型**

```ts
const hoveredCountry = ref<string | null>(null);
const elementsByKey = new Map<string, HTMLElement>();
```

尖括号 `<...>` 是给工具补类型。`ref<string | null>` 表示这个 ref 里可以放字符串或 `null`。`Map<string, HTMLElement>` 表示 key 是字符串，value 是 DOM 元素。

通用格式：

```ts
工具名<里面装的类型>(初始值);
new Map<键类型, 值类型>();
```

泛型可以理解成“这个工具里面装什么类型”。`ref`、`Map` 这类工具经常和泛型一起出现。

```ts
const hoveredCountry = ref<string | null>(null);
// hoveredCountry.value 可以是 string 或 null
```

**Promise<T>**

```ts
fetch('/world.json');
// 类型可以理解为 Promise<Response>
```

`Promise<T>` 也是泛型。`Promise<Response>` 表示这个 Promise 完成后，里面的结果是 `Response`。

加上 `await` 后，拿到的就是 Promise 里面的结果。

```ts
const promise = fetch('/world.json');      // Promise<Response>
const response = await fetch('/world.json'); // Response
```

通用格式：

```ts
Promise<完成后的结果类型>
```

#### 类型推断和收窄

**类型推断**

```ts
const zoom = 3;
const name = '上海';
const currentZoom = ref(zoomMin);
```

类型推断表示：你没有手写类型，但 TS 能从右边的值推出来。

上面几行可以读成：

```text
zoom 是 number。
name 是 string。
currentZoom 的类型可以从 zoomMin 推出来。
```

所以不是每个变量都要写 `: 类型`。当右边的值很明确时，可以让 TS 自己推；当初始值是 `null`、空数组、复杂对象时，再手动补类型。

**类型收窄**

TS 会根据判断条件缩小类型范围。

```ts
const rawName = feature.properties?.name;

if (typeof rawName !== 'string') return;

rawName.trim();
```

一开始 `rawName` 可能是很多类型。经过 `typeof rawName !== 'string'` 这句判断后，后面的代码里，TS 知道 `rawName` 是字符串，所以允许调用 `.trim()`。

通用读法：

```text
判断之前：类型比较宽。
判断之后：类型被缩小。
```

项目里还会看到这种写法：

```ts
const isCoordinate = (value: unknown): value is Coordinate => {
  return Array.isArray(value)
    && typeof value[0] === 'number'
    && typeof value[1] === 'number';
};
```

`value is Coordinate` 是写在返回类型位置的特殊标注，叫类型谓词。这类函数通常叫类型守卫。

它有两层意思：

```text
运行时：这个函数返回 true 或 false。
类型检查时：如果返回 true，TS 就把 value 当成 Coordinate 看。
```

TS 会相信这个声明，所以判断条件要写准。如果只判断 `Array.isArray(value)`，还不够证明它一定是 `[number, number]`。

#### 外部数据安全

**unknown 和 any**

```ts
const value = JSON.parse(text) as unknown;
```

`unknown` 表示现在还不知道类型。用它之前必须先检查。

```ts
if (typeof value === 'string') {
  value.trim();
}
```

`any` 表示放弃类型检查。它也能让代码少报错，但错误会更晚暴露。

```text
unknown：还不知道，所以先检查。
any：不检查，先放过。
```

项目里读外部 JSON、第三方库回调、接口返回值时，更常见的是先用 `unknown` 接住，再逐步判断。

**类型断言 as**

```ts
const polygon = buildRegionPolygon(name, geometry.coordinates as Polygon);
const message = (error as Error).message;
```

`as Polygon`、`as Error` 是类型断言。意思是告诉 TS：这里先按这个类型理解。

通用格式：

```ts
值 as 类型
```

类型断言只改变 TS 的理解，不会改变真实数据。`error as Error` 不会把错误对象变成 `Error`，只是告诉 TS 这里按 `Error` 读取。

所以 `as` 适合用在自己已经判断确认过、但 TS 推不出来的地方（当我们前面使用 `unknown` 或者 `any`）。不能把它当成数据转换。

#### 工程常见类型写法

**工具类型**

TS 自带一些类型工具，用来从已有类型加工出新类型。

```ts
type MarkerPosition = Pick<ProjectedFootprintMarker, 'x' | 'y'>;
type IconMap = Record<IconName, { vb: string; d: string }>;
type UpdatePayload = Partial<DownloadGrantRecord>;
```

常见读法：

```text
Pick<A, 'x' | 'y'>：从 A 里面只挑 x 和 y。
Record<K, V>：一个对象，键是 K，值是 V。
Partial<T>：把 T 里面的字段都变成可选。
Readonly<T>：只读，不能随便改。
```

这些不是运行时函数，不会真的去挑字段或改对象。它们只是在类型层面帮 TS 描述数据。

项目里还会看到 `typeof` 放在类型位置：

```ts
type ThreeModule = typeof import('three');
```

这里的 `typeof` 不是在运行时判断字符串、数字。它是在类型层面拿到 `three` 模块的类型。

**函数参数和返回值**

```ts
const formatMarkerCount = (count: number): string => {
  return count > 99 ? '99+' : String(count);
};
```

`count: number` 是参数类型。`): string` 是返回值类型。读函数时先看输入，再看输出。

通用格式：

```ts
const 函数名 = (参数名: 参数类型): 返回类型 => {
  return 返回值;
};
```

有时返回值类型可以不写，TS 会从 `return` 推出来。

```ts
const getZoom = () => {
  return 4;
};
```

这里 TS 能看出 `getZoom` 返回的是 `number`。但参数类型通常更建议写清楚，因为参数是外部传进来的。

**函数类型参数**

有时一个函数的参数本身也是函数，也就是回调函数。项目里的地图适配器有这种定义：

```ts
init(
  container: HTMLElement,
  onReady: () => void,
  onZoom: (zoom: number) => void,
): Promise<void>;
```

这里 `onReady` 和 `onZoom` 都不是普通值，而是函数参数。

```text
onReady: () => void
表示 onReady 是一个函数：不接收参数，也不返回结果。

onZoom: (zoom: number) => void
表示 onZoom 是一个函数：接收一个 number 参数，也不返回结果。
```

调用时就要传两个函数进去：

```ts
adapter.init(
  mapEl.value,
  () => {
    renderMarkers();
  },
  (zoom) => {
    currentZoom.value = zoom;
  },
);
```

读法就是：`init` 初始化地图；地图准备好时调用第二个函数；地图缩放时调用第三个函数，并把当前 `zoom` 传进去。

#### 类型导入

**import type：只导入类型**

```ts
import type { FootprintGroup } from './footprint';
```

`import type` 是 TS 的类型导入。它只导入类型，编译后不会变成浏览器里的真实代码。

`FootprintGroup` 是类型，只给 TS 检查代码用。页面真正运行时不需要它，所以可以写成 `import type`。

也可以把真实函数和类型放在同一行：

```ts
import { groupFootprints, type FootprintGroup } from './footprint';
```

这里 `groupFootprints` 是运行时要调用的函数，`FootprintGroup` 只是类型，所以前面加 `type`。

## 第三部分：读懂父子组件通信

### 先看父子组件

一个 `.vue` 文件通常就是一个组件。一个组件在自己的模板里使用另一个组件时，它们就形成了父子关系。

`FootprintsView.vue` 里使用了 `FootprintFlatMap.vue`。这时可以这样看：

```vue
<script setup lang="ts">
import FootprintFlatMap from './FootprintFlatMap.vue';
import type { FootprintGroup } from './footprint';

const domesticFootprints: FootprintGroup[] = [];

const selectFootprint = (footprint: FootprintGroup) => {
  console.log(footprint.key);
};
</script>

<template>
  <FootprintFlatMap
    :footprints="domesticFootprints"
    @select="selectFootprint"
  />
</template>
```

这里先只看结构。`domesticFootprints` 是父组件准备的数据，`selectFootprint` 是父组件准备的函数。

结构如下：

```text
FootprintsView 是父组件。
FootprintFlatMap 是子组件。
父组件通过 props 把数据传给子组件，比如 footprints。
子组件通过 emit 把事件通知给父组件，比如 select。
```

这里先知道方向就够了：`props` 是父传子，`emit` 是子通知父。具体怎么声明、怎么传值、怎么接事件，下面两节再展开。

### defineProps：组件接收什么

子组件用 `defineProps` 声明自己能接收什么，父组件在组件标签上把这些值传进去。这里的子组件就是 `FootprintFlatMap`，父组件就是 `FootprintsView`。

`defineProps` 描述 `FootprintFlatMap.vue` 接收哪些数据。项目里这样写：

```ts
const props = defineProps<{
  footprints: FootprintGroup[];
  source: 'china' | 'world';
}>();
```

`defineProps<...>()` 里的内容就是 `FootprintFlatMap` 能接收的 props 类型。它对应 `FootprintsView.vue` 模板里的这些传值：

```vue
source="china"
:footprints="domesticFootprints"
```

放到这个例子里，同样是 `FootprintsView` 给 `FootprintFlatMap` 传 props，写法分两种。

不加冒号时，右边就是固定字符串：

```vue
source="china"
```

`FootprintFlatMap` 收到的是字符串 `'china'`。

加冒号时，右边会当成 JS 表达式执行：

```vue
:footprints="domesticFootprints"
```

Vue 会回到 `FootprintsView.vue` 的 `script` 里找 `domesticFootprints`，然后把它的值传给 `FootprintFlatMap`。

所以 `:` 常用来传不是固定字符串的值，比如响应式变量、`computed` 结果、布尔值、数字、数组、对象或表达式结果。

这是 Vue 对组件 props 的命名规则。模板里常写短横线命名，子组件脚本里读到的是驼峰命名。

```text
active-key 对应 activeKey
map-label  对应 mapLabel
```

注意，不是随便两个名字都能对应。只有这种短横线和驼峰之间的规则转换，Vue 才会自动匹配。

放到这个例子里：

```text
FootprintFlatMap 需要接收：
footprints：足迹点数组
source：只能是 china 或 world
```

通用格式：

```ts
const props = defineProps<{
  字段名: 字段类型;
  可选字段?: 字段类型;
}>();
```

抽出来看，父组件模板里对应：

```vue
<ChildComponent 固定字段="固定字符串" :动态字段="script里的变量" />
```

### defineEmits：组件会发出什么事件

子组件用 `defineEmits` 声明自己会发什么事件，再用 `emit` 发出去；父组件用 `@事件名` 接住它。这里的子组件就是 `FootprintFlatMap`，父组件就是 `FootprintsView`。

`defineEmits` 描述 `FootprintFlatMap.vue` 会向外发出哪些事件。项目里有这个写法：

```ts
const emit = defineEmits<{
  select: [footprint: FootprintGroup];
}>();
```

它表示 `FootprintFlatMap` 会发一个事件：

```text
select 事件：带一个 FootprintGroup 参数
```

`FootprintFlatMap` 创建每个 marker 时，会拿到当前 marker 对应的 `footprint`。用户操作这个 marker 时，`FootprintFlatMap` 再把这个 `footprint` 通过事件发出去：

```ts
const createMarkerElement = (footprint: FootprintGroup) => {
  // ...
  marker.addEventListener('click', () => emit('select', footprint));
};
```

`FootprintsView.vue` 的模板里用 `@` 接住这个事件：

```vue
@select="selectFootprint"
```

`FootprintsView.vue` 里对应的是这个函数：

```ts
const selectFootprint = (footprint: FootprintGroup) => {
  activeFootprintKey.value = footprint.key;
};
```

完整链路就是：

```text
FootprintFlatMap 创建某个足迹点的 marker
用户点击这个 marker
FootprintFlatMap 执行 emit('select', footprint)
FootprintsView 的 @select 接住事件
FootprintsView 执行 selectFootprint
FootprintsView 更新 activeFootprintKey
```

如果写错事件名，TS 会提醒。

```ts
emit('selected', footprint); // 错，事件名不是 selected
```

通用格式：

```ts
const emit = defineEmits<{
  事件名: [参数名: 参数类型];
}>();

emit('事件名', 参数值);
```

抽出来看，父组件模板里对应：

```vue
<ChildComponent @事件名="父组件里的处理函数" />
```

## 第四部分：读懂组件内部状态

### ref 和 reactive：组件内部的响应式状态

`props` 和 `emit` 负责组件之间通信。`ref` 和 `reactive` 负责组件内部自己的状态。

#### ref：单个响应式值

`ref` 常用来装一个值。

```ts
const loading = ref(true);
```

在 `<script setup>` 里读取和修改它，要用 `.value`：

```ts
loading.value = false;
```

但在同一个 `.vue` 文件的 `<template>` 里用它，不需要 `.value`。Vue 会自动解包：

```vue
<LoadingState v-if="loading" title="正在加载旅行足迹" />
```

也就是说，`script` 里写 `loading.value`，`template` 里写 `loading`。

如果是 DOM 元素，`template` 会用 `ref="mapEl"` 把真实元素交回 `script`：

```vue
<script setup lang="ts">
import { ref } from 'vue';

const mapEl = ref<HTMLElement | null>(null);
</script>

<template>
  <div ref="mapEl" class="footprint-flat-map" />
</template>
```

普通文本、按钮、列表通常不需要这样拿 DOM。Vue 自己会根据数据把页面渲染出来。

需要 DOM 容器的场景，通常是外部库要自己往页面里画东西。项目里的地图就是这种情况：

```ts
adapter.init(mapEl.value, ...);
```

`mapEl.value` 表示地图要画到哪里，也就是那个真实的 `div` 容器。

#### reactive：响应式对象

`reactive` 常用来装一整个对象。项目里的图片详情编辑表单就是这种写法：

```ts
const editForm = reactive<ImageLightboxEditForm>({
  title: '',
  caption: '',
  tags: '',
  location_name: '',
  location_lat: '',
  location_lng: '',
});
```

使用 `reactive` 时，不需要 `.value`，直接读写对象字段：

```ts
editForm.title = '新的标题';
editForm.location_name = '上海';
```

在 `template` 里也可以直接用对象字段：

```vue
<template>
  <input v-model="editForm.title" />
  <p>{{ editForm.location_name }}</p>
</template>
```

这里 `editForm.title` 和 `editForm.location_name` 都来自 `script` 里的 `reactive` 对象。`v-model` 会把输入框内容和 `editForm.title` 连起来。

可以这样区分：

```text
ref：一个值外面套一层响应式壳，脚本里用 .value。
reactive：整个对象变成响应式对象，脚本里直接改字段。
```

通用格式：

```ts
const 一个值 = ref<类型>(初始值);
一个值.value = 新值;

const 一个对象 = reactive<类型>({
  字段: 初始值,
});
一个对象.字段 = 新值;
```

模板里对应：

```vue
<p>{{ 一个值 }}</p>
<input v-model="一个对象.字段" />
```

`reactive` 要注意解构问题：

```ts
const { title } = editForm;
```

这句的意思是：从 `editForm` 里取出 `title`，放到一个新的本地变量 `title` 里。

如果 `editForm` 是 `reactive` 对象，这样拆出来的 `title` 通常就不是响应式字段了。后面 `editForm.title` 变了，单独拿出来的 `title` 不会自动跟着变。

所以响应式对象一般这样读写：

```ts
editForm.title = '新的标题';
console.log(editForm.title);
```

如果确实要把字段拆出来，并且还想保留响应式，要用 `toRefs`：

```ts
const { title } = toRefs(editForm);
title.value = '新的标题';
```

`reactive` 对象不要直接解构后长期使用，优先写 `editForm.title`。

### computed：从已有数据算出新数据

`computed` 也是响应式的一部分。它不是普通函数的替代品，而是“根据响应式数据自动计算出来的值”。

它和普通函数的区别在这里：

```ts
const getActiveFootprint = () =>
  props.footprints.find((f) => f.key === props.activeKey) ?? null;

const activeFootprint = computed(() =>
  props.footprints.find((f) => f.key === props.activeKey) ?? null,
);
```

`getActiveFootprint` 是普通函数。要拿结果时，需要主动调用：

```ts
const result = getActiveFootprint();
```

`activeFootprint` 是响应式计算结果。只要 `props.footprints` 或 `props.activeKey` 变了，Vue 就知道它需要更新。

在 `template` 里，`computed` 也像普通值一样使用，不需要写 `.value`：

```vue
<p v-if="activeFootprint">{{ activeFootprint.name }}</p>
```

通用格式：

```ts
const 计算结果 = computed(() => {
  return 根据已有数据算出来的值;
});
```

模板里对应：

```vue
<p>{{ 计算结果 }}</p>
```

`computed` 不负责“做动作”，它负责从已有数据算出一个新数据。

### watch：数据变化时执行

`computed` 是为了算出一个新值。`watch` 是为了在数据变化后执行一段动作。

足迹地图里有这种写法：

```ts
watch(
  () => props.footprints,
  () => {
    if (!zoomReady.value) return;
    expandedClusterId.value = null;
    renderMarkers();
    if (!activeFootprint.value) fitView();
  },
  { deep: true },
);
```

可以拆成三块读：

```text
() => props.footprints：监听父组件传进来的足迹数组。
第二个函数：足迹数组变化后要做什么。
{ deep: true }：数组里面的内容变化也要观察。
```

这里不是为了在页面上直接显示一个新值，而是为了重新同步地图上的 marker。父组件模板里传了 `:footprints="domesticFootprints"`，这个值变化后，子组件里的 `props.footprints` 也会变，`watch` 就会重新渲染地图点位。

通用格式：

```ts
watch(
  () => 要监听的数据,
  (新值, 旧值) => {
    数据变化后要执行的动作;
  },
);
```

第一个函数说明“看谁”，第二个函数说明“变了以后做什么”。

第二个函数的参数可以写，也可以不写。

只关心“数据变了”，不需要比较新旧值时，可以省略参数：

```ts
watch(
  () => props.footprints,
  () => {
    renderMarkers();
  },
);
```

需要知道变成了什么，或要和变化前比较时，再写参数：

```ts
watch(
  () => props.activeKey,
  (newKey, oldKey) => {
    console.log(newKey, oldKey);
  },
);
```

参数名可以自己起，Vue 按位置传值：第一个是新值，第二个是旧值。

### onMounted 和 onBeforeUnmount：组件生命周期

生命周期说的是组件什么时候进入页面，什么时候离开页面。它常用来处理“需要真实页面元素”的事情。

```ts
onMounted(() => {
  if (!mapEl.value) return;
  void adapter.init(
    mapEl.value,
    () => {
      zoomReady.value = true;
      currentZoom.value = adapter.getZoom();
      renderMarkers();
      fitView();
    },
    (zoom) => {
      currentZoom.value = zoom;
      if (!zoomReady.value) return;
      expandedClusterId.value = null;
      renderMarkers();
    },
  );
});

onBeforeUnmount(() => {
  adapter.destroy();
  elementsByKey.clear();
  clusterElementsById.clear();
  clustersById.clear();
  mountedMarkerKeys.clear();
});
```

`mapEl` 来自 template：

```vue
<div ref="mapEl" class="footprint-flat-map" />
```

组件还没进入页面时，这个真实 DOM 元素还不存在，所以地图初始化要放在 `onMounted` 里。组件离开页面前，地图实例和缓存元素要清理，所以放在 `onBeforeUnmount` 里。

可以先这样记：

```text
onMounted：组件出现在页面上之后执行，适合初始化地图、拿 DOM、注册事件。
onBeforeUnmount：组件离开页面之前执行，适合销毁地图、移除事件、清理缓存。
```

通用格式：

```ts
onMounted(() => {
  初始化操作;
});

onBeforeUnmount(() => {
  清理操作;
});
```

创建资源放 `onMounted`，释放资源放 `onBeforeUnmount`。

### defineAsyncComponent：异步加载组件

`FootprintsView.vue` 里有这个：

```ts
const ImageLightbox = defineAsyncComponent(() => import('@/features/images/ImageLightbox.vue'));
```

它表示图片预览组件不一开始就加载，而是在需要时再异步加载。这里的 `ImageLightbox` 仍然是一个组件变量，后面在 template 里像普通组件一样使用：

```vue
<ImageLightbox
  :open="lightboxOpen"
  :image="lightboxImage"
  @close="lightboxOpen = false"
  @prev="showPreviousImage"
  @next="showNextImage"
/>
```

这段可以这样对应：

```text
script：defineAsyncComponent 定义 ImageLightbox。
template：用 <ImageLightbox /> 显示图片预览组件。
:open / :image：把父组件状态传给图片预览组件。
@close / @prev / @next：接住图片预览组件发出的事件。
```

通用格式：

```ts
const LazyComponent = defineAsyncComponent(() => import('./LazyComponent.vue'));
```

模板里对应：

```vue
<LazyComponent />
```

`defineAsyncComponent` 让组件延后加载，但加载完成后，它在模板里仍然像普通组件一样使用。

它不是所有组件都要用。适合异步加载的组件，通常有这些特点：

```text
不是首屏必须显示。
体积比较大。
用户不一定会打开。
```

比如图片预览弹窗、富文本编辑器、复杂图表、管理面板，都适合考虑异步加载。

不太适合异步加载的，是页面一进来就要显示的小组件，比如按钮、列表项、头部导航、简单卡片。它们本来就小，拆成异步组件反而会增加等待和请求。

`defineAsyncComponent` 是 Vue 提供的组件懒加载方式。

## 第五部分：读懂项目里的安全 TS 写法

第二部分已经讲过 `unknown`、`as` 和类型收窄的语法。这里不再重复语法，只看它们在项目里为什么出现。

足迹地球会读取 GeoJSON、地图边界、WASM 和第三方库对象。这些数据不是我们自己手写的普通变量，所以代码要先检查，再使用。

### 类型守卫：value is Something

`footprint.ts` 里有这段：

```ts
interface LocatedImage extends ImageRecord {
  location_lat: number;
  location_lng: number;
}

const isLocatedImage = (image: ImageRecord): image is LocatedImage =>
  image.location_lat !== null && image.location_lng !== null
  && Number.isFinite(image.location_lat) && Number.isFinite(image.location_lng);
```

重点是这里：

```ts
image is LocatedImage
```

它表示这个函数不只是返回 `true` 或 `false`，还会告诉 TS：

```text
如果返回 true，那么 image 就可以当作 LocatedImage 使用。
```

所以后面可以这样写：

```ts
for (const image of images) {
  if (!isLocatedImage(image)) continue;

  image.location_lat.toFixed(4);
  image.location_lng.toFixed(4);
}
```

因为 `continue` 之后，TS 知道剩下的 `image` 一定有有效经纬度。

### unknown：不知道类型时先别乱用

`geo-hit.ts` 里有：

```ts
interface GeoJsonFeature {
  type?: string;
  properties?: {
    name?: unknown;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}
```

为什么 `name` 和 `coordinates` 是 `unknown`？因为 GeoJSON 是外部 JSON 数据，读进来时不能完全相信它的结构。

`unknown` 的意思是：

```text
我现在不知道它是什么类型。
用它之前必须先检查。
```

所以代码会这样判断：

```ts
const rawName = feature.properties?.name;
if (typeof rawName !== 'string' || !rawName.trim()) return;
```

只有确认 `rawName` 是字符串后，才会调用 `.trim()`。

这比 `any` 更安全。`any` 是放弃检查，`unknown` 是要求你先检查。

### 类型断言 as

项目里会看到 `as`：

```ts
const polygon = buildRegionPolygon(name, geometry.coordinates as Polygon);
```

`as Polygon` 的意思是告诉 TS：

```text
这里我认为 geometry.coordinates 可以按 Polygon 来看。
```

类型断言不会改变运行时数据，只改变 TS 的理解。

所以它要谨慎使用。通常在这种场景下才用：

- 已经做过运行时检查，但 TS 还推不出来。
- 第三方库类型太宽，需要缩窄。
- DOM 查询时，你知道元素类型。

例如：

```ts
const container = document.querySelector('#stage') as HTMLElement;
```

这表示你确认 `#stage` 是一个 `HTMLElement`。

如果确认不了，就不要直接断言，要先判断。

### 类型和运行时要分开看

这是读 TS 代码最重要的一点。

类型只在开发阶段帮助检查，不会在浏览器里变成真实逻辑。

比如：

```ts
interface SceneState {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
}
```

这段只是告诉 TS `SceneState` 长什么样。它不会创建场景，也不会创建相机。

真正创建运行时对象的是这种代码：

```ts
const scene = new ThreeScene();
const camera = new ThreePerspectiveCamera(45, width / height, 0.1, 1000);
```

读代码时可以分两层：

```text
interface / type / import type：说明数据形状。
const / let / function / new / fetch：真实执行逻辑。
```

## 第六部分：把这些用回项目代码

### 读项目代码的顺序

读 `.vue` 组件时，不要从第一行硬啃到最后一行。可以按这个顺序来：

#### 第一步：看导入

```ts
import { computed, ref } from 'vue';
import type { FootprintGroup } from './footprint';
```

先分清三类东西：Vue API、项目函数、类型导入。

#### 第二步：看 template 用了哪些名字

```vue
<FootprintFlatMap
  :footprints="domesticFootprints"
  :active-key="activeFootprintKey"
  @select="selectFootprint"
/>
```

先把模板里的组件、`:props`、`@事件`、`ref="..."` 圈出来，再回到 script 里找这些名字。

#### 第三步：看 props 和 emit

```ts
const props = defineProps<{ visitedPlaces: string[]; visitedCoordinates?: VisitedCoordinate[] }>();
```

`defineProps` 告诉你组件从外部拿什么数据。`defineEmits` 告诉你组件会向外发什么事件。

#### 第四步：看组件内部状态

```ts
const loading = ref(true);
let sceneState: SceneState | null = null;
```

这里能看到组件自己保存什么状态。`ref`、`reactive` 是响应式状态，普通 `let` 常用于保存运行时对象。

#### 第五步：看 computed、watch 和生命周期

```ts
const boundaryStatus = computed(() => {
  if (loading.value) return '正在加载边界';
  if (loadError.value) return `地图边界加载失败：${loadError.value}`;
  if (!hoveredCountry.value) return '悬停查看边界';
  return `${hoveredCountry.value} ${isVisitedCountry(hoveredCountry.value) ? '已去过' : '尚未去过'}`;
});
```

`computed` 通常负责从状态推导显示结果。

Vue 里这些函数决定代码什么时候执行：

```ts
onMounted(() => {
  // 组件挂载后执行
});

onBeforeUnmount(() => {
  // 组件卸载前执行
});

watch(() => props.footprints, () => {
  // 数据变化时执行
});
```

足迹页的地图和地球组件里，很多 DOM 操作、Three.js 初始化、资源清理都跟生命周期有关。`watch` 负责数据变化后的同步。

#### 第六步：看函数

函数读输入输出：

```ts
const findRegionByLngLat = (
  index: GeoHitIndex | null,
  lat: number,
  lng: number,
): string | null => {
  // ...
};
```

这就表示：

```text
输入命中索引、纬度、经度。
返回区域名，或者 null。
```

#### 补充：读普通 .ts 工具文件

项目里不是所有逻辑都放在 `.vue` 组件里。`.vue` 组件负责页面结构、组件通信、响应式状态和生命周期；普通 `.ts` 工具文件负责可复用的计算和数据处理。

可以理解成：不是把 `.vue` 的 `script` 全部拆出去，而是把和页面结构关系不强、可以复用、可以单独测试的逻辑拆到 `.ts` 文件里。

比如：

```text
footprint.ts：把图片整理成足迹点，定义足迹相关类型。
marker-clustering.ts：处理屏幕坐标聚合和 spiderfy 展开。
geo-hit.ts：处理经纬度命中区域的计算。
```

组件再通过 `import` 把这些函数组合回来使用：

```ts
import { groupFootprints } from './footprint';
import { clusterProjectedMarkers } from './marker-clustering';
```

读普通 `.ts` 工具文件时，顺序更简单：

```text
先看导入。
再看 interface / type。
再看导出的函数输入输出。
最后看函数内部的循环、判断和 return。
```

#### 练习：读 clusterProjectedMarkers 函数

下面用 `src/features/footprints/marker-clustering.ts` 里的 `clusterProjectedMarkers` 练习。这个文件是普通 `.ts` 工具文件，不是 Vue 组件。

先看这段代码，目标不是立刻看懂每一行算法，而是先抓住函数输入、输出和主要流程：

```ts
export const clusterProjectedMarkers = (
  points: ProjectedFootprintMarker[],
  options: MarkerClusterOptions = {},
): FootprintMarkerCluster[] => {
  const radius = options.radius ?? DEFAULT_CLUSTER_RADIUS;
  const visited = new Set<string>();
  const clusters: FootprintMarkerCluster[] = [];

  for (const seed of points) {
    if (visited.has(seed.key)) continue;

    const members: ProjectedFootprintMarker[] = [seed];
    visited.add(seed.key);

    let center = { x: seed.x, y: seed.y };
    let changed = true;

    while (changed) {
      changed = false;

      for (const candidate of points) {
        if (visited.has(candidate.key)) continue;
        if (distance(candidate, center) > radius) continue;

        members.push(candidate);
        visited.add(candidate.key);
        center = {
          x: average(members.map((point) => point.x)),
          y: average(members.map((point) => point.y)),
        };
        changed = true;
      }
    }

    clusters.push(buildCluster(members));
  }

  return clusters;
};
```

按分类读：

```text
一、函数输入

points: ProjectedFootprintMarker[]
输入是一组已经投影到屏幕坐标的点。

options: MarkerClusterOptions = {}
第二个参数可选，不传就是空对象。

二、函数输出

): FootprintMarkerCluster[]
返回一组聚合结果。

三、内部变量

new Set<string>()
visited 是字符串集合，用来记录已经处理过的 key。

const clusters: FootprintMarkerCluster[] = []
clusters 只能放 FootprintMarkerCluster。

const members: ProjectedFootprintMarker[] = [seed]
members 是当前聚合里的点。

四、主要流程

for (const seed of points)
从每一个点开始尝试建立聚合。

if (visited.has(seed.key)) continue
已经处理过的点跳过，避免重复进入多个聚合。

for (const candidate of points)
再拿其他点和当前聚合中心比较距离。

members.push(candidate)
距离够近的点加入当前聚合。

clusters.push(buildCluster(members))
把当前聚合整理成一个结果，放进 clusters。

return clusters
返回所有聚合结果。
```

这里 TS 的作用是把每个变量的形状固定住。你读算法时，不用猜 `members` 里到底是什么，它一定是 `ProjectedFootprintMarker`。

### 什么时候该补类型

写 TS 时，不需要每一行都补类型。判断标准可以先记成一句话：

```text
外部传进来的、TS 推不准的、会被别人复用的，应该写清楚类型。
右边已经很明确的临时值，可以让 TS 自己推。
```

适合补类型的地方，通常有三类。

第一类是边界位置，也就是数据从外面进来，或者函数要被别人调用：

- 函数参数。
- 函数返回值复杂时。
- 外部数据，比如 GeoJSON。

比如函数参数来自外部调用，最好写清楚：

```ts
const selectFootprint = (footprint: FootprintGroup) => {
  activeFootprintKey.value = footprint.key;
};
```

第二类是结构复杂，光看右边不容易马上看懂：

- 对象结构，比如 `interface SceneState`。
- `Map`、`Set` 这种容器。

第三类是 TS 推不准：

- `ref(null)` 这种初始值太空的地方。
- 空数组、复杂对象、可能为 `null` 的状态。

比如空数组右边只有 `[]`，TS 不知道以后要放什么，适合补类型：

```ts
const clusters: FootprintMarkerCluster[] = [];
```

不需要补类型的地方，一般是右边已经把类型说清楚了：

- 简单数字和字符串常量。
- TS 能从右边推出来的变量。
- 临时中间变量。

比如：

```ts
const radius = options.radius ?? DEFAULT_CLUSTER_RADIUS;
```

这里不用写 `const radius: number`，TS 能推出来。

### 新手常见误区

#### 误区一：把类型当成真实代码

`interface` 不会在浏览器里运行。它只是开发时的检查。

#### 误区二：一看到泛型就慌

`ref<string | null>(null)` 可以先读成：

```text
这个 ref 里面装 string 或 null。
```

不用一开始就理解泛型的全部原理。

#### 误区三：乱用 as

`as` 可以让 TS 闭嘴，但不能让错误数据变正确。能先判断就先判断。

#### 误区四：把 unknown 改成 any

`unknown` 是安全写法。它逼你先检查外部数据。`any` 会绕过检查，出错更晚。

### 本文的学习路线

按下面这个顺序学，目标是读懂本文涉及的 Vue script、普通 `.ts` 工具函数和基础 TS 类型。

```text
1. JS 基础写法：箭头函数、数组方法、对象、属性访问、模板字符串、三元表达式、可选链、空值合并、解构、展开、异步
2. TS 基础类型：name: string、string | null、'china' | 'world'
3. TS 数据结构：Type[]、[number, number]、interface、radius?: number
4. TS 复用写法：type、泛型、Promise<T>、函数参数、返回类型、函数类型参数
5. TS 安全检查：类型收窄、value is Type、unknown、as
6. TS 工程写法：Pick、Record、Partial、import type
7. Vue script 和 template：script 里准备变量、函数和组件，template 里使用它们
8. Vue 父子组件通信：父组件传 props，子组件用 emit 通知父组件
9. Vue 组件内部状态：ref / reactive / computed / watch、生命周期，以及它们在 template 中使用
10. 项目阅读顺序：先读普通 .ts 工具函数，再读 Vue 组件里的通信和状态
```

读项目时可以先从 `marker-clustering.ts` 开始。它没有 Vue 模板，也没有 Three.js，只有 JS/TS 函数和类型，最适合练手。

然后读 `footprint.ts`，重点看类型守卫 `isLocatedImage`。

接着读 `FootprintFlatMap.vue`，重点看 script 和 template 的对应关系，以及 `defineProps`、`defineEmits`、`ref`、`computed`、`watch` 和 DOM 元素类型。

最后再读 `WorldBoundaryGlobe.vue` 和 `geo-hit.ts`。本文只帮助你先识别里面的 props、ref、computed、watch、生命周期、unknown、as、函数输入输出这些基础结构。

## 小结

读 Vue 里的 `.ts` 代码，不需要先背完整语法。先抓住三件事就够了。

第一，`.ts` 文件还是 JavaScript，只是加了类型。导入导出、基础符号、对象、函数调用、箭头函数、表达式、解构、循环、数组方法、事件回调、异步、JSON、错误处理这些 JS 写法要先能读出来。

第二，类型是在说明数据形状。`interface`、`type`、`import type` 都属于这一层。

第三，Vue 的 `<template>`、`defineProps`、`defineEmits`、`ref`、`reactive`、`computed`、`watch` 和生命周期函数，是把类型和组件运行连接起来的地方。

遇到外部数据时要先检查，再使用。`unknown`、类型守卫、`null` 判断，都是为了让代码在真实数据面前更稳。
