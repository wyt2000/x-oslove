### Language Server Protocol

#### 基本协议

基本协议由标题和内容部分（与HTTP相比）组成。 标题和内容部分以“ \ r \ n”分隔。

#### 标题部分

标题部分由标题字段组成。 每个标题字段均包含一个名称和一个值，并以“：”（冒号和空格）分隔。 每个标题字段均以“ \ r \ n”结尾。 考虑到最后一个标头字段和整个标题本身都以'\ r \ n'结尾，并且至少有一个标题是强制性的，这意味着两个'\ r \ n'序列始终紧接在消息的内容部分之前 。

当前支持以下标题字段：

| 标题字段名称 | 值类型 | 描述                                                         |
| ------------ | ------ | ------------------------------------------------------------ |
| 内容长度     | 数字   | 内容部分的长度（以字节为单位）。 此标头是必需的。            |
| 内容类型     | 字符串 | 内容部分的媒体类型。 默认为application / vscode-jsonrpc; 字符集= utf-8 |

标题部分使用“ ascii”编码进行编码。 其中包括分隔标题和内容部分的“ \ r \ n”。

#### 内容部分

包含消息的实际内容。 消息的内容部分使用JSON-RPC来描述请求、响应和通知。 使用Content-Type字段中提供的字符集对内容部分进行编码。 它默认为utf-8，这是目前唯一支持的编码。 如果服务器或客户端收到的标题与utf-8编码不同，则应以错误响应。

（协议的早期版本使用字符串常量utf8，根据规范这不是正确的编码常量。）为了向后兼容，强烈建议客户端和服务器将字符串utf8视为utf-8。

#### 实例：

```
Content-Length: ...\r\n
\r\n
{
	"jsonrpc": "2.0",
	"id": 1,
	"method": "textDocument/didOpen",
	"params": {
		...
	}
}
```

#### 基本协议JSON结构

以下TypeScript定义描述了基本的JSON-RPC协议：

#### 抽象信息

JSON-RPC定义的总体概括消息。 语言服务器协议始终使用“ 2.0”作为jsonrpc版本。

#### 请求信息

请求信息用来描述客户端和服务器之间请求。每个已处理的请求都必须将响应发送回请求的发送者。

#### 回应信息

作为请求结果发送的响应消息。 如果请求未提供结果值，则请求的接收者仍然需要返回响应消息以符合JSON RPC规范。 在这种情况下，应将ResponseMessage的result属性设置为null，以发出成功的请求信号。

#### 通知信息

 处理过的通知消息一定不能发回响应。 他们像事件一样工作。

#### 通知和请求

以“  /”开头的通知和请求是取决于协议实现的消息，可能无法在所有客户端或服务器中实现。 例如，如果服务器实现使用单线程同步编程语言，则服务器几乎无法响应“  / cancelRequest”通知。 如果服务器或客户端收到以“ $ /”开头的通知，则可以忽略该通知。 如果服务器或客户端收到以“ ​ /”开头的请求，则必须使用错误代码MethodNotFound（例如-32601）对请求进行错误处理。

#### 撤销支持

基本协议支持取消请求。 要取消请求，将发送具有以下属性的通知消息：

- 方法：“ $ / cancelRequest”
- 参数：CancelParams定义如下：

```
interface CancelParams {
	/**
	 * The request id to cancel.
	 */
	id: number | string;
}
```

被取消的请求仍然需要从服务器返回并发送回响应。 它不能打开/悬挂。 这符合JSON RPC协议，该协议要求每个请求都将响应发送回去。 另外，它允许在取消时返回部分结果。 如果请求返回取消后的错误响应，建议将错误代码设置为

```
ErrorCodes.RequestCancelled
```

#### 进度支持

基本协议还支持以通用方式报告进度。 此机制可用于报告任何类型的进度，包括工作完成进度（通常用于使用进度条在用户界面中报告进度）和部分结果进度以支持结果流。

进度通知具有以下属性：

- 方法：“ $ /progress”

- 参数：ProgressParams定义如下：

```
type ProgressToken = number | string;
interface ProgressParams<T> {
	/**
	 * The progress token provided by the client or server.
	 */
	token: ProgressToken;

	/**
	 * The progress data.
	 */
	value: T;
}
```

根据令牌(token)报告进度。 令牌与请求ID不同，请求ID允许带外报告进度并进行通知。

#### Language Server Protocol

语言服务器协议定义了一组JSON-RPC请求，响应和通知消息，这些消息使用上述基本协议进行交换。 本节开始描述协议中使用的基本JSON结构。 该文档使用TypeScript接口来描述这些接口。 基于基本的JSON结构，描述了实际请求及其响应和通知。

通常，语言服务器协议支持JSON-RPC消息，但是此处定义的基本协议使用约定，以便传递给请求/通知消息的参数应该是对象类型（如果完全传递的话）。 但是，这不允许在自定义消息中使用数组参数类型。

该协议当前假定一台服务器提供一种工具。 协议目前不支持在不同工具之间共享一台服务器。 这种共享将需要额外的协议，例如 锁定文档以支持并发编辑。

#### 基本JSON结构

#### [URI](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#uri)

URI以字符串形式传输。 URI的格式在http://tools.ietf.org/html/rfc3986中定义

```
  foo://example.com:8042/over/there?name=ferret#nose
  \_/   \______________/\_________/ \_________/ \__/
   |           |            |            |        |
scheme     authority       path        query   fragment
   |   _____________________|__
  / \ /                        \
  urn:example:animal:ferret:nose
```

我们还维护一个节点模块，以将字符串解析为方案，权限，路径，查询和片段URI组件。 GitHub存储库是https://github.com/Microsoft/vscode-uri，npm模块是https://www.npmjs.com/package/vscode-uri。

许多接口都包含与文档URI对应的字段。 为了清楚起见，将此类字段的类型声明为DocumentUri。 通过电线，它仍将作为字符串传输，但这保证了该字符串的内容可以解析为有效的URI。

```
type DocumentUri = string;
```

#### 文字文件(testdoc)

当前协议是为文本文档量身定制的，其内容可以表示为字符串。 当前不支持二进制文件。 文档内的位置（请参见下面的位置定义）表示为从零开始的行和字符偏移量。 偏移量基于UTF-16字符串表示形式。 由于a在UTF-16中使用两个代码单元表示，因此a的形式为a𐐀b的字符串，其中字符a的字符偏移量为0，𐐀的字符偏移量为1，b的字符偏移量为3。 为了确保客户端和服务器将字符串拆分为同一行表示，协议指定以下行尾序列：“ \ n”，“ \ r \ n”和“ \ r”。

位置是行尾字符不可知的。 因此，您不能指定表示\ r | \ n或\ n |的位置 在哪里 代表字符偏移量。

```
export const EOL: string[] = ['\n', '\r\n', '\r'];
```

#### 位置

位置是行尾字符不可知的。 因此，您不能指定表示\ r | \ n或\ n |的位置 在哪里 代表字符偏移量。

```
interface Position {
	/**
	 * Line position in a document (zero-based).
	 */
	line: number;

	/**
	 * Character offset on a line in a document (zero-based). Assuming that the line is
	 * represented as a string, the `character` value represents the gap between the
	 * `character` and `character + 1`.
	 *
	 * If the character value is greater than the line length it defaults back to the
	 * line length.
	 */
	character: number;
}
```

#### 范围

文本文档中的范围，表示为（从零开始）开始和结束位置。 范围与编辑器中的选择相当。 因此，最终位置是排他的。 如果要指定包含包含行结束符的行的范围，请使用表示下一行开始的结束位置。 例如：



```
{
    start: { line: 5, character: 23 },
    end : { line: 6, character: 0 }
}
```

```
interface Range {
	/**
	 * The range's start position.
	 */
	start: Position;

	/**
	 * The range's end position.
	 */
	end: Position;
}
```

#### 位置

表示资源内部的位置，例如文本文件内的一行。

```
interface Location {
	uri: DocumentUri;
	range: Range;
}
```

#### 定位链接

表示源位置和目标位置之间的链接。

```
interface LocationLink {

	/**
	 * Span of the origin of this link.
	 *
	 * Used as the underlined span for mouse interaction. Defaults to the word range at
	 * the mouse position.
	 */
	originSelectionRange?: Range;

	/**
	 * The target resource identifier of this link.
	 */
	targetUri: DocumentUri;

	/**
	 * The full target range of this link. If the target for example is a symbol then target range is the
	 * range enclosing this symbol not including leading/trailing whitespace but everything else
	 * like comments. This information is typically used to highlight the range in the editor.
	 */
	targetRange: Range;

	/**
	 * The range that should be selected and revealed when this link is being followed, e.g the name of a function.
	 * Must be contained by the the `targetRange`. See also `DocumentSymbol#range`
	 */
	targetSelectionRange: Range;
}
```

#### 诊断

表示诊断，例如编译器错误或警告。 诊断对象仅在资源范围内有效。

```
export interface Diagnostic {
	/**
	 * The range at which the message applies.
	 */
	range: Range;

	/**
	 * The diagnostic's severity. Can be omitted. If omitted it is up to the
	 * client to interpret diagnostics as error, warning, info or hint.
	 */
	severity?: DiagnosticSeverity;

	/**
	 * The diagnostic's code, which might appear in the user interface.
	 */
	code?: number | string;

	/**
	 * A human-readable string describing the source of this
	 * diagnostic, e.g. 'typescript' or 'super lint'.
	 */
	source?: string;

	/**
	 * The diagnostic's message.
	 */
	message: string;

	/**
	 * Additional metadata about the diagnostic.
	 *
	 * @since 3.15.0
	 */
	tags?: DiagnosticTag[];

	/**
	 * An array of related diagnostic information, e.g. when symbol-names within
	 * a scope collide all definitions can be marked via this property.
	 */
	relatedInformation?: DiagnosticRelatedInformation[];
}
```

该协议当前支持以下诊断级别和标签：

```
export namespace DiagnosticSeverity {
	/**
	 * Reports an error.
	 */
	export const Error: 1 = 1;
	/**
	 * Reports a warning.
	 */
	export const Warning: 2 = 2;
	/**
	 * Reports an information.
	 */
	export const Information: 3 = 3;
	/**
	 * Reports a hint.
	 */
	export const Hint: 4 = 4;
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4;

/**
 * The diagnostic tags.
 *
 * @since 3.15.0
 */
export namespace DiagnosticTag {
    /**
     * Unused or unnecessary code.
     *
     * Clients are allowed to render diagnostics with this tag faded out instead of having
     * an error squiggle.
     */
    export const Unnecessary: 1 = 1;
    /**
     * Deprecated or obsolete code.
     *
     * Clients are allowed to rendered diagnostics with this tag strike through.
     */
    export const Deprecated: 2 = 2;
}

export type DiagnosticTag = 1 | 2;
```

DiagnosticRelatedInformation定义如下：

```
/**
 * Represents a related message and source code location for a diagnostic. This should be
 * used to point to code locations that cause or are related to a diagnostics, e.g when duplicating
 * a symbol in a scope.
 */
export interface DiagnosticRelatedInformation {
	/**
	 * The location of this related diagnostic information.
	 */
	location: Location;

	/**
	 * The message of this related diagnostic information.
	 */
	message: string;
}

```

#### 命令

表示对命令的引用。 提供标题，该标题将用于表示UI中的命令。 命令由字符串标识符标识。 推荐的处理命令的方法是，如果客户端和服务器提供相应的功能，则在服务器端实现它们的执行。 或者，工具扩展代码可以处理该命令。 该协议当前未指定一组众所周知的命令。

```
interface Command {
	/**
	 * Title of the command, like `save`.
	 */
	title: string;
	/**
	 * The identifier of the actual command handler.
	 */
	command: string;
	/**
	 * Arguments that the command handler should be
	 * invoked with.
	 */
	arguments?: any[];
}
```

#### 文字编辑

适用于文本文档的文本编辑。

```
interface TextEdit {
	/**
	 * The range of the text document to be manipulated. To insert
	 * text into a document create a range where start === end.
	 */
	range: Range;

	/**
	 * The string to be inserted. For delete operations use an
	 * empty string.
	 */
	newText: string;
}
```

#### 文字编辑数组

复杂的文本操作通过TextEdit的数组进行描述，代表对文档的单个更改。

所有文本编辑范围均指对其进行计算的文档中的位置。 因此，他们将文档从状态S1移动到S2，而没有描述任何中间状态。 文本编辑范围一定不能重叠，这意味着原始文档的任何部分都不能被多个编辑操作。 但是，多个编辑可能具有相同的开始位置：多个插入或任意数量的插入，然后是单个删除或替换编辑。 如果多个插入具有相同位置，则数组中的顺序定义插入的字符串在结果文本中出现的顺序

#### TextDocumentEdit

描述单个文本文档上的文本更改。 文本文档被称为VersionedTextDocumentIdentifier，以允许客户端在应用编辑之前检查文本文档的版本。 TextDocumentEdit描述了Si版本上的所有更改，应用这些更改后，将文档移至Si + 1版本。 因此，TextDocumentEdit的创建者无需对编辑数组进行排序或进行任何排序。 但是，编辑必须不重叠。

```
export interface TextDocumentEdit {
	/**
	 * The text document to change.
	 */
	textDocument: VersionedTextDocumentIdentifier;

	/**
	 * The edits to be applied.
	 */
	edits: TextEdit[];
}
```

#### 文件资源更改

文件资源更改允许服务器通过客户端创建，重命名和删除文件和文件夹。 请注意，名称是关于文件的，但是这些操作应该在文件和文件夹上起作用。 这与语言服务器协议中的其他命名保持一致（请参阅可以监视文件和文件夹的文件监视程序）。 相应的更改文字如下所示：

```
/**
 * Options to create a file.
 */
export interface CreateFileOptions {
	/**
	 * Overwrite existing file. Overwrite wins over `ignoreIfExists`
	 */
	overwrite?: boolean;
	/**
	 * Ignore if exists.
	 */
	ignoreIfExists?: boolean;
}

/**
 * Create file operation
 */
export interface CreateFile {
	/**
	 * A create
	 */
	kind: 'create';
	/**
	 * The resource to create.
	 */
	uri: DocumentUri;
	/**
	 * Additional options
	 */
	options?: CreateFileOptions;
}

/**
 * Rename file options
 */
export interface RenameFileOptions {
	/**
	 * Overwrite target if existing. Overwrite wins over `ignoreIfExists`
	 */
	overwrite?: boolean;
	/**
	 * Ignores if target exists.
	 */
	ignoreIfExists?: boolean;
}

/**
 * Rename file operation
 */
export interface RenameFile {
	/**
	 * A rename
	 */
	kind: 'rename';
	/**
	 * The old (existing) location.
	 */
	oldUri: DocumentUri;
	/**
	 * The new location.
	 */
	newUri: DocumentUri;
	/**
	 * Rename options.
	 */
	options?: RenameFileOptions;
}

/**
 * Delete file options
 */
export interface DeleteFileOptions {
	/**
	 * Delete the content recursively if a folder is denoted.
	 */
	recursive?: boolean;
	/**
	 * Ignore the operation if the file doesn't exist.
	 */
	ignoreIfNotExists?: boolean;
}

/**
 * Delete file operation
 */
export interface DeleteFile {
	/**
	 * A delete
	 */
	kind: 'delete';
	/**
	 * The file to delete.
	 */
	uri: DocumentUri;
	/**
	 * Delete options.
	 */
	options?: DeleteFileOptions;
}
```

#### 工作区编辑

工作空间编辑代表对工作空间中管理的许多资源的更改。 编辑应提供更改或documentChanges。 如果客户端可以处理版本化的文档编辑，并且存在documentChanges，则后者优先于更改。

```
export interface WorkspaceEdit {
	/**
	 * Holds changes to existing resources.
	 */
	changes?: { [uri: DocumentUri]: TextEdit[]; };

	/**
	 * Depending on the client capability `workspace.workspaceEdit.resourceOperations` document changes
	 * are either an array of `TextDocumentEdit`s to express changes to n different text documents
	 * where each text document edit addresses a specific version of a text document. Or it can contain
	 * above `TextDocumentEdit`s mixed with create, rename and delete file / folder operations.
	 *
	 * Whether a client supports versioned document edits is expressed via
	 * `workspace.workspaceEdit.documentChanges` client capability.
	 *
	 * If a client neither supports `documentChanges` nor `workspace.workspaceEdit.resourceOperations` then
	 * only plain `TextEdit`s using the `changes` property are supported.
	 */
	documentChanges?: (TextDocumentEdit[] | (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[]);
}
```

#### WorkspaceEditClientCapabilities

随着时间的流逝，工作空间编辑的功能不断发展。 客户可以使用以下客户端功能来描述他们的支持：

- 属性路径（可选）：workspace.workspaceEdit

- 属性类型：WorkspaceEditClientCapabilities定义如下：

```
export interface WorkspaceEditClientCapabilities {
	/**
	 * The client supports versioned document changes in `WorkspaceEdit`s
	 */
	documentChanges?: boolean;

	/**
	 * The resource operations the client supports. Clients should at least
	 * support 'create', 'rename' and 'delete' files and folders.
	 *
	 * @since 3.13.0
	 */
	resourceOperations?: ResourceOperationKind[];

	/**
	 * The failure handling strategy of a client if applying the workspace edit
	 * fails.
	 *
	 * @since 3.13.0
	 */
	failureHandling?: FailureHandlingKind;
}

/**
 * The kind of resource operations supported by the client.
 */
export type ResourceOperationKind = 'create' | 'rename' | 'delete';

export namespace ResourceOperationKind {

	/**
	 * Supports creating new files and folders.
	 */
	export const Create: ResourceOperationKind = 'create';

	/**
	 * Supports renaming existing files and folders.
	 */
	export const Rename: ResourceOperationKind = 'rename';

	/**
	 * Supports deleting existing files and folders.
	 */
	export const Delete: ResourceOperationKind = 'delete';
}

export type FailureHandlingKind = 'abort' | 'transactional' | 'undo' | 'textOnlyTransactional';

export namespace FailureHandlingKind {

	/**
	 * Applying the workspace change is simply aborted if one of the changes provided
	 * fails. All operations executed before the failing operation stay executed.
	 */
	export const Abort: FailureHandlingKind = 'abort';

	/**
	 * All operations are executed transactional. That means they either all
	 * succeed or no changes at all are applied to the workspace.
	 */
	export const Transactional: FailureHandlingKind = 'transactional';


	/**
	 * If the workspace edit contains only textual file changes they are executed transactional.
	 * If resource changes (create, rename or delete file) are part of the change the failure
	 * handling strategy is abort.
	 */
	export const TextOnlyTransactional: FailureHandlingKind = 'textOnlyTransactional';

	/**
	 * The client tries to undo the operations already executed. But there is no
	 * guarantee that this is succeeding.
	 */
	export const Undo: FailureHandlingKind = 'undo';
}
TextDocumentIdentifier
Text documents are identified using a URI. On the protocol level, URIs are passed as strings. The corresponding JSON structure looks like this:

interface TextDocumentIdentifier {
	/**
	 * The text document's URI.
	 */
	uri: DocumentUri;
}
```

#### TextDocumentItem

将文本文档从客户端传输到服务器的项目。

```
interface TextDocumentItem {
	/**
	 * The text document's URI.
	 */
	uri: DocumentUri;

	/**
	 * The text document's language identifier.
	 */
	languageId: string;

	/**
	 * The version number of this document (it will increase after each
	 * change, including undo/redo).
	 */
	version: number;

	/**
	 * The content of the opened text document.
	 */
	text: string;
}
```

文本文档具有一种语言标识符，以便在处理多种语言以避免重新解释文件扩展名时在服务器端标识该文档。 如果文档引用下面列出的一种编程语言，则建议客户端使用这些ID。

| Language            | Identifier                                                   |
| ------------------- | ------------------------------------------------------------ |
| ABAP                | `abap`                                                       |
| Windows Bat         | `bat`                                                        |
| BibTeX              | `bibtex`                                                     |
| Clojure             | `clojure`                                                    |
| Coffeescript        | `coffeescript`                                               |
| C                   | `c`                                                          |
| C++                 | `cpp`                                                        |
| C#                  | `csharp`                                                     |
| CSS                 | `css`                                                        |
| Diff                | `diff`                                                       |
| Dart                | `dart`                                                       |
| Dockerfile          | `dockerfile`                                                 |
| Elixir              | `elixir`                                                     |
| Erlang              | `erlang`                                                     |
| F#                  | `fsharp`                                                     |
| Git                 | `git-commit` and `git-rebase`                                |
| Go                  | `go`                                                         |
| Groovy              | `groovy`                                                     |
| Handlebars          | `handlebars`                                                 |
| HTML                | `html`                                                       |
| Ini                 | `ini`                                                        |
| Java                | `java`                                                       |
| JavaScript          | `javascript`                                                 |
| JavaScript React    | `javascriptreact`                                            |
| JSON                | `json`                                                       |
| LaTeX               | `latex`                                                      |
| Less                | `less`                                                       |
| Lua                 | `lua`                                                        |
| Makefile            | `makefile`                                                   |
| Markdown            | `markdown`                                                   |
| Objective-C         | `objective-c`                                                |
| Objective-C++       | `objective-cpp`                                              |
| Perl                | `perl`                                                       |
| Perl 6              | `perl6`                                                      |
| PHP                 | `php`                                                        |
| Powershell          | `powershell`                                                 |
| Pug                 | `jade`                                                       |
| Python              | `python`                                                     |
| R                   | `r`                                                          |
| Razor (cshtml)      | `razor`                                                      |
| Ruby                | `ruby`                                                       |
| Rust                | `rust`                                                       |
| SCSS                | `scss` (syntax using curly brackets), `sass` (indented syntax) |
| Scala               | `scala`                                                      |
| ShaderLab           | `shaderlab`                                                  |
| Shell Script (Bash) | `shellscript`                                                |
| SQL                 | `sql`                                                        |
| Swift               | `swift`                                                      |
| TypeScript          | `typescript`                                                 |
| TypeScript React    | `typescriptreact`                                            |
| TeX                 | `tex`                                                        |
| Visual Basic        | `vb`                                                         |
| XML                 | `xml`                                                        |
| XSL                 | `xsl`                                                        |
| YAML                | `yaml`                                                       |

#### VersionedTextDocumentIdentifier

表示文本文档的特定版本的标识符。

```
interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
	/**
	 * The version number of this document. If a versioned text document identifier
	 * is sent from the server to the client and the file is not open in the editor
	 * (the server has not received an open notification before) the server can send
	 * `null` to indicate that the version is known and the content on disk is the
	 * master (as speced with document content ownership).
	 *
	 * The version number of a document will increase after each change, including
	 * undo/redo. The number doesn't need to be consecutive.
	 */
	version: number | null;
}
```

#### TextDocumentPositionParams

是1.0中带有内联参数的TextDocumentPosition。

在传递文本文档的请求中使用的参数文字和该文档内的位置。

```
interface TextDocumentPositionParams {
	/**
	 * The text document.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The position inside the text document.
	 */
	position: Position;
}
```

#### DocumentFilter

文档过滤器通过语言，方案或模式等属性来表示文档。 一个示例是适用于磁盘上TypeScript文件的过滤器。 另一个示例是过滤器，该过滤器适用于名称为package.json的JSON文件：

```
{ language: 'typescript', scheme: 'file' }
{ language: 'json', pattern: '**/package.json' }
```

```
export interface DocumentFilter {
	/**
	 * A language id, like `typescript`.
	 */
	language?: string;

	/**
	 * A Uri [scheme](#Uri.scheme), like `file` or `untitled`.
	 */
	scheme?: string;

	/**
	 * A glob pattern, like `*.{ts,js}`.
	 *
	 * Glob patterns can have the following syntax:
	 * - `*` to match one or more characters in a path segment
	 * - `?` to match on one character in a path segment
	 * - `**` to match any number of path segments, including none
	 * - `{}` to group conditions (e.g. `**​/*.{ts,js}` matches all TypeScript and JavaScript files)
	 * - `[]` to declare a range of characters to match in a path segment (e.g., `example.[0-9]` to match on `example.0`, `example.1`, …)
	 * - `[!...]` to negate a range of characters to match in a path segment (e.g., `example.[!0-9]` to match on `example.a`, `example.b`, but not `example.0`)
	 */
	pattern?: string;
}
```

文档选择器是一个或多个文档过滤器的组合。

```
export type DocumentSelector = DocumentFilter[];
```

#### StaticRegistrationOptions

静态注册选项可用于使用给定的服务器控件ID在初始化结果中注册功能，以便以后可以取消注册功能。

```
/**
 * Static registration options to be returned in the initialize request.
 */
export interface StaticRegistrationOptions {
	/**
	 * The id used to register the request. The id can be used to deregister
	 * the request again. See also Registration#id.
	 */
	id?: string;
}
```

#### TextDocumentRegistrationOptions

动态注册一组文本文档请求的选项。

```
/**
 * General text document registration options.
 */
export interface TextDocumentRegistrationOptions {
	/**
	 * A document selector to identify the scope of the registration. If set to null
	 * the document selector provided on the client side will be used.
	 */
	documentSelector: DocumentSelector | null;
}
```

#### 标记内容

MarkupContent文字表示字符串值，其内容可以用不同的格式表示。 当前支持纯文本和降价格式。 MarkupContent通常用于结果文字的文档属性中，例如CompletionItem或SignatureInformation。

```
/**
 * Describes the content type that a client supports in various
 * result literals like `Hover`, `ParameterInfo` or `CompletionItem`.
 *
 * Please note that `MarkupKinds` must not start with a `$`. This kinds
 * are reserved for internal usage.
 */
export namespace MarkupKind {
	/**
	 * Plain text is supported as a content format
	 */
	export const PlainText: 'plaintext' = 'plaintext';

	/**
	 * Markdown is supported as a content format
	 */
	export const Markdown: 'markdown' = 'markdown';
}
export type MarkupKind = 'plaintext' | 'markdown';

/**
 * A `MarkupContent` literal represents a string value which content is interpreted base on its
 * kind flag. Currently the protocol supports `plaintext` and `markdown` as markup kinds.
 *
 * If the kind is `markdown` then the value can contain fenced code blocks like in GitHub issues.
 * See https://help.github.com/articles/creating-and-highlighting-code-blocks/#syntax-highlighting
 *
 * Here is an example how such a string can be constructed using JavaScript / TypeScript:
 * ```typescript
 * let markdown: MarkdownContent = {
 *  kind: MarkupKind.Markdown,
 *	value: [
 *		'# Header',
 *		'Some text',
 *		'```typescript',
 *		'someCode();',
 *		'```'
 *	].join('\n')
 * };
 * ```
 *
 * *Please Note* that clients might sanitize the return markdown. A client could decide to
 * remove HTML from the markdown to avoid script execution.
 */
export interface MarkupContent {
	/**
	 * The type of the Markup
	 */
	kind: MarkupKind;

	/**
	 * The content itself
	 */
	value: string;
}
```

#### 工作完成进度

使用通用的$ / progress通知报告完成的工作进度。 完成进度通知的价值有效载荷可以采用三种不同的形式。

#### 工作完成进度开始

要开始进度报告，必须发送带有以下负载的$ /进度通知：

```
export interface WorkDoneProgressBegin {

	kind: 'begin';

	/**
	 * Mandatory title of the progress operation. Used to briefly inform about
	 * the kind of operation being performed.
	 *
	 * Examples: "Indexing" or "Linking dependencies".
	 */
	title: string;

	/**
	 * Controls if a cancel button should show to allow the user to cancel the
	 * long running operation. Clients that don't support cancellation are allowed
	 * to ignore the setting.
	 */
	cancellable?: boolean;

	/**
	 * Optional, more detailed associated progress message. Contains
	 * complementary information to the `title`.
	 *
	 * Examples: "3/25 files", "project/src/module2", "node_modules/some_dep".
	 * If unset, the previous progress message (if any) is still valid.
	 */
	message?: string;

	/**
	 * Optional progress percentage to display (value 100 is considered 100%).
	 * If not provided infinite progress is assumed and clients are allowed
	 * to ignore the `percentage` value in subsequent in report notifications.
	 *
	 * The value should be steadily rising. Clients are free to ignore values
	 * that are not following this rule.
	 */
	percentage?: number;
}
```

#### 工作完成进度报告

使用以下有效负载完成报告进度：

```
export interface WorkDoneProgressReport {

	kind: 'report';

	/**
	 * Controls enablement state of a cancel button. This property is only valid if a cancel
	 * button got requested in the `WorkDoneProgressStart` payload.
	 *
	 * Clients that don't support cancellation or don't support control the button's
	 * enablement state are allowed to ignore the setting.
	 */
	cancellable?: boolean;

	/**
	 * Optional, more detailed associated progress message. Contains
	 * complementary information to the `title`.
	 *
	 * Examples: "3/25 files", "project/src/module2", "node_modules/some_dep".
	 * If unset, the previous progress message (if any) is still valid.
	 */
	message?: string;

	/**
	 * Optional progress percentage to display (value 100 is considered 100%).
	 * If not provided infinite progress is assumed and clients are allowed
	 * to ignore the `percentage` value in subsequent in report notifications.
	 *
	 * The value should be steadily rising. Clients are free to ignore values
	 * that are not following this rule.
	 */
	percentage?: number;
}
```

#### 工作完成进度结束

使用以下有效负载完成进度报告结束的信号：

```
export interface WorkDoneProgressEnd {

	kind: 'end';

	/**
	 * Optional, a final message indicating to for example indicate the outcome
	 * of the operation.
	 */
	message?: string;
}
```

#### 启动工作完成进度

工作完成进度可以通过两种不同的方式启动：

1. 由请求的发送者（通常是客户端）使用requests参数文字中的预定义的workDoneToken属性来完成。
2. 由服务器使用请求窗口/ workDoneProgress /创建。

考虑一个客户端向服务器发送textDocument / reference请求，并且该客户端接受该请求的工作进度报告。 为了向服务器发出信号，客户端将在参考请求参数中添加一个workDoneToken属性。 像这样：

```
{
	"textDocument": {
		"uri": "file:///folder/file.ts"
	},
	"position": {
		"line": 9,
		"character": 5
	},
	"context": {
		"includeDeclaration": true
	},
	// The token used to report work done progress.
	"workDoneToken": "1d546990-40a3-4b77-b134-46622995f6ae"
}
```

服务器使用workDoneToken报告特定textDocument /引用的进度。 对于以上请求，$ / progress通知参数如下所示：

```
{
	"token": "1d546990-40a3-4b77-b134-46622995f6ae",
	"value": {
		"kind": "begin",
		"title": "Finding references for A#foo",
		"cancellable": false,
		"message": "Processing file X.ts",
		"percentage": 0
	}
}
```

服务器启动工作完成进度的工作原理相同。 唯一的区别是服务器使用window / workDoneProgress / create请求来请求进度用户界面，该请求提供了令牌，此令牌随后用于报告进度。

#### 发信号通知工作完成进度报告

为了使协议向后兼容，仅当客户端使用客户端功能window.workDoneProgress发出相应的支持信号时，才允许兼容服务器使用工作完成进度报告，定义如下：

```
/**
	 * Window specific client capabilities.
	 */
	window?: {
		/**
		 * Whether client supports handling progress notifications.
		 */
		workDoneProgress?: boolean;
	}
```

为避免客户端在发送请求之前设置进度监控器用户界面，但服务器实际上未报告任何进度，因此服务器需要用相应的服务器功能来发出已完成工作进度报告的信号。 对于上面的查找参考示例，服务器将通过在服务器功能中设置referencesProvider属性来发出这种支持信号，如下所示：

```
{
	"referencesProvider": {
		"workDoneProgress": true
	}
}
```

#### WorkDoneProgressParams

用于传递工作完成进度令牌的参数文字。

```
export interface WorkDoneProgressParams {
	/**
	 * An optional token that a server can use to report work done progress.
	 */
	workDoneToken?: ProgressToken;
}
```

#### WorkDoneProgressOptions

用于指示完成工作进度的选项支持服务器功能。

```
export interface WorkDoneProgressOptions {
	workDoneProgress?: boolean;
}
```

#### 部分结果进度

使用通用$ / progress通知还报告部分结果。 在大多数情况下，部分结果进度通知的值有效载荷与最终结果相同。 例如，工作空间/符号请求的结果类型为SymbolInformation []。 因此，部分结果也是SymbolInformation []类型的。 客户端是否接受请求的部分结果通知是通过在请求参数中添加partialResultToken来发出的。 例如，同时支持完成的工作和部分结果进度的textDocument / reference请求可能看起来像这样：

```
{
	"textDocument": {
		"uri": "file:///folder/file.ts"
	},
	"position": {
		"line": 9,
		"character": 5
	},
	"context": {
		"includeDeclaration": true
	},
	// The token used to report work done progress.
	"workDoneToken": "1d546990-40a3-4b77-b134-46622995f6ae",
	// The token used to report partial result progress.
	"partialResultToken": "5f6f349e-4f81-4a3b-afff-ee04bff96804"
}
```

然后，partialResultToken用于报告查找引用请求的部分结果。

如果服务器通过相应的$ / progress报告部分结果，则必须使用n $ / progress通知报告整个结果。 最终响应的结果值必须为空。 这避免了关于如何解释最终结果的困惑，例如。 作为另一部分结果或替换结果。

如果响应错误，则应按以下方式处理提供的部分结果：

- 该代码等于RequestCancelled：客户端可以自由使用提供的结果，但应明确说明请求已被取消并且可能不完整。

- 在所有其他情况下，不应使用提供的部分结果。

#### PartialResultParams

用于传递部分结果标记的参数文字。

```
export interface PartialResultParams {
	/**
	 * An optional token that a server can use to report partial results (e.g. streaming) to
	 * the client.
	 */
	partialResultToken?: ProgressToken;
}
```

#### 实际协议

本节记录了实际的语言服务器协议。它使用以下格式：

- 描述请求的标题
- 可选的客户端功能部分，描述了请求的客户端功能。这包括客户端功能属性路径和JSON结构。
- 可选的服务器功能部分，描述请求的服务器功能。这包括服务器功能属性路径和JSON结构。
- 请求部分描述发送的请求的格式。该方法是一个字符串，用于标识使用TypeScript接口记录参数的请求。还记录了该请求是否支持工作完成进度和部分结果进度。
- 响应部分描述了响应的格式。结果项描述成功返回的数据。可选的部分结果项描述了部分结果通知的返回数据。 error.data描述发生错误时返回的数据。请记住，如果失败，响应中已经包含一个error.code和一个error.message字段。仅在协议强制使用某些错误代码或消息的情况下才指定这些字段。如果服务器可以自由决定这些值，则不在此处列出。
- “注册选项”部分描述了请求或通知是否支持动态功能注册的注册选项。
#### 请求，通知和响应排序
对请求的响应应以与请求在服务器或客户端上显示的顺序大致相同的顺序发送。因此，例如，如果服务器接收到textDocument / completion请求，然后接收到textDocument / signatureHelp请求，则服务器通常通常会先返回textDocument / completion的响应，然后返回textDocument / signatureHelp的响应。

但是，服务器可能决定使用并行执行策略，并且可能希望以与收到请求不同的顺序返回响应。只要此重新排序不影响响应的正确性，服务器就可以这样做。例如，允许对textDocument / completion和textDocument / signatureHelp的结果重新排序，因为这些请求中的每一个通常不会影响其他请求的输出。另一方面，服务器很可能不应该对textDocument / definition和textDocument / rename请求重新排序，因为执行后者可能会影响前者的结果。

#### 服务器寿命
当前的协议规范定义服务器的生存期由客户端（例如VS Code或Emacs之类的工具）管理。由客户端决定何时启动（进程方式）和何时关闭服务器。

初始化请求（：leftwards_arrow_with_hook :)
初始化请求作为第一个请求从客户端发送到服务器。如果服务器在初始化请求之前收到请求或通知，则它应采取以下措施：

- 对于请求，响应应该是错误，代码为：-32002。该消息可以由服务器选择。
- 除退出通知外，应删除通知。这将允许没有初始化请求的情况下退出服务器。
在服务器用InitializeResult响应初始化请求之前，客户端不得向服务器发送任何其他请求或通知。此外，除非服务器以InitializeResult响应，否则不允许服务器向客户端发送任何请求或通知，但在初始化请求期间，允许服务器发送通知window / showMessage，window / logMessage和遥测/事件以及向客户端发送的window / showMessageRequest请求。如果客户端在初始化参数中设置进度令牌（例如，属性workDoneToken），则服务器还可以使用从服务器发送到客户端的$ / progress通知使用该令牌（并且仅使用该令牌）。

初始化请求只能发送一次。

请求：

- 方法：“初始化”
- 参数：InitializeParams定义如下：

```
interface InitializeParams extends WorkDoneProgressParams {
	/**
	 * The process Id of the parent process that started
	 * the server. Is null if the process has not been started by another process.
	 * If the parent process is not alive then the server should exit (see exit notification) its process.
	 */
	processId: number | null;

	/**
	 * Information about the client
	 *
	 * @since 3.15.0
	 */
	clientInfo?: {
		/**
		 * The name of the client as defined by the client.
		 */
		name: string;

		/**
		 * The client's version as defined by the client.
		 */
		version?: string;
	};

	/**
	 * The rootPath of the workspace. Is null
	 * if no folder is open.
	 *
	 * @deprecated in favour of rootUri.
	 */
	rootPath?: string | null;

	/**
	 * The rootUri of the workspace. Is null if no
	 * folder is open. If both `rootPath` and `rootUri` are set
	 * `rootUri` wins.
	 */
	rootUri: DocumentUri | null;

	/**
	 * User provided initialization options.
	 */
	initializationOptions?: any;

	/**
	 * The capabilities provided by the client (editor or tool)
	 */
	capabilities: ClientCapabilities;

	/**
	 * The initial trace setting. If omitted trace is disabled ('off').
	 */
	trace?: 'off' | 'messages' | 'verbose';

	/**
	 * The workspace folders configured in the client when the server starts.
	 * This property is only available if the client supports workspace folders.
	 * It can be `null` if the client supports workspace folders but none are
	 * configured.
	 *
	 * @since 3.6.0
	 */
	workspaceFolders?: WorkspaceFolder[] | null;
}
```

其中ClientCapabilities和TextDocumentClientCapabilities的定义如下：

TextDocumentClientCapabilities定义编辑器/工具在文本文档上提供的功能。

```
/**
 * Text document specific client capabilities.
 */
export interface TextDocumentClientCapabilities {

	synchronization?: TextDocumentSyncClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/completion` request.
	 */
	completion?: CompletionClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/hover` request.
	 */
	hover?: HoverClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/signatureHelp` request.
	 */
	signatureHelp?: SignatureHelpClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/declaration` request.
	 *
	 * @since 3.14.0
	 */
	declaration?: DeclarationClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/definition` request.
	 */
	definition?: DefinitionClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/typeDefinition` request.
	 *
	 * @since 3.6.0
	 */
	typeDefinition?: TypeDefinitionClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/implementation` request.
	 *
	 * @since 3.6.0
	 */
	implementation?: ImplementationClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/references` request.
	 */
	references?: ReferenceClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/documentHighlight` request.
	 */
	documentHighlight?: DocumentHighlightClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/documentSymbol` request.
	 */
	documentSymbol?: DocumentSymbolClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/codeAction` request.
	 */
	codeAction?: CodeActionClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/codeLens` request.
	 */
	codeLens?: CodeLensClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/documentLink` request.
	 */
	documentLink?: DocumentLinkClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/documentColor` and the
	 * `textDocument/colorPresentation` request.
	 *
	 * @since 3.6.0
	 */
	colorProvider?: DocumentColorClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/formatting` request.
	 */
	formatting?: DocumentFormattingClientCapabilities

	/**
	 * Capabilities specific to the `textDocument/rangeFormatting` request.
	 */
	rangeFormatting?: DocumentRangeFormattingClientCapabilities;

	/** request.
	 * Capabilities specific to the `textDocument/onTypeFormatting` request.
	 */
	onTypeFormatting?: DocumentOnTypeFormattingClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/rename` request.
	 */
	rename?: RenameClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/publishDiagnostics` notification.
	 */
	publishDiagnostics?: PublishDiagnosticsClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/foldingRange` request.
	 *
	 * @since 3.10.0
	 */
	foldingRange?: FoldingRangeClientCapabilities;

	/**
	 * Capabilities specific to the `textDocument/selectionRange` request.
	 *
	 * @since 3.15.0
	 */
	selectionRange?: SelectionRangeClientCapabilities;
}
```

ClientCapabilities定义了客户端支持的动态注册，工作空间和文本文档功能的功能。实验可以用来传递正在开发的实验功能。为了将来的兼容性，ClientCapabilities对象文字可以设置比当前定义更多的属性。接收到具有未知属性的ClientCapabilities对象文字的服务器应忽略这些属性。缺少的属性应解释为不具备此功能。如果通常缺少属性定义了子属性，则所有缺少的子属性都应解释为缺少相应功能。

该协议的3.0版引入了客户端功能。因此，它们仅描述了3.x或更高版本中引入的功能。协议的2.x版本中存在的功能对于客户端仍然是必需的。客户不能选择不提供他们。因此，即使客户端省略了ClientCapabilities.textDocument.synchronization，仍然仍然需要客户端提供文本文档同步（例如，打开，更改和关闭通知）。

```
interface ClientCapabilities {
	/**
	 * Workspace specific client capabilities.
	 */
	workspace?: {
		/**
		* The client supports applying batch edits
		* to the workspace by supporting the request
		* 'workspace/applyEdit'
		*/
		applyEdit?: boolean;

		/**
		* Capabilities specific to `WorkspaceEdit`s
		*/
		workspaceEdit?: WorkspaceEditClientCapabilities;

		/**
		* Capabilities specific to the `workspace/didChangeConfiguration` notification.
		*/
		didChangeConfiguration?: DidChangeConfigurationClientCapabilities;

		/**
		* Capabilities specific to the `workspace/didChangeWatchedFiles` notification.
		*/
		didChangeWatchedFiles?: DidChangeWatchedFilesClientCapabilities;

		/**
		* Capabilities specific to the `workspace/symbol` request.
		*/
		symbol?: WorkspaceSymbolClientCapabilities;

		/**
		* Capabilities specific to the `workspace/executeCommand` request.
		*/
		executeCommand?: ExecuteCommandClientCapabilities;

		/**
		* The client has support for workspace folders.
		*
		* Since 3.6.0
		*/
		workspaceFolders?: boolean;

		/**
		* The client supports `workspace/configuration` requests.
		*
		* Since 3.6.0
		*/
		configuration?: boolean;
	};

	/**
	 * Text document specific client capabilities.
	 */
	textDocument?: TextDocumentClientCapabilities;

	/**
	 * Window specific client capabilities.
	 */
	window?: {
		/**
		 * Whether client supports handling progress notifications. If set servers are allowed to
		 * report in `workDoneProgress` property in the request specific server capabilities.
		 *
		 * Since 3.15.0
		 */
		workDoneProgress?: boolean;
	}

	/**
	 * Experimental client capabilities.
	 */
	experimental?: any;
}
```

响应：

结果：InitializeResult定义如下：

```
interface InitializeResult {
	/**
	 * The capabilities the language server provides.
	 */
	capabilities: ServerCapabilities;

	/**
	 * Information about the server.
	 *
	 * @since 3.15.0
	 */
	serverInfo?: {
		/**
		 * The name of the server as defined by the server.
		 */
		name: string;

		/**
		 * The server's version as defined by the server.
		 */
		version?: string;
	};
}
```

错误代码：

```
/**
 * Known error codes for an `InitializeError`;
 */
export namespace InitializeError {
	/**
	 * If the protocol version provided by the client can't be handled by the server.
	 * @deprecated This initialize error got replaced by client capabilities. There is
	 * no version handshake in version 3.0x
	 */
	export const unknownProtocolVersion: number = 1;
}
```

错误数据：

```
interface InitializeError {
	/**
	 * Indicates whether the client execute the following retry logic:
	 * (1) show the message provided by the ResponseError to the user
	 * (2) user selects retry or cancel
	 * (3) if user selected retry the initialize method is sent again.
	 */
	retry: boolean;
}
```

服务器可以发出以下信号：

```
interface ServerCapabilities {
	/**
	 * Defines how text documents are synced. Is either a detailed structure defining each notification or
	 * for backwards compatibility the TextDocumentSyncKind number. If omitted it defaults to `TextDocumentSyncKind.None`.
	 */
	textDocumentSync?: TextDocumentSyncOptions | number;

	/**
	 * The server provides completion support.
	 */
	completionProvider?: CompletionOptions;

	/**
	 * The server provides hover support.
	 */
	hoverProvider?: boolean | HoverOptions;

	/**
	 * The server provides signature help support.
	 */
	signatureHelpProvider?: SignatureHelpOptions;

	/**
	 * The server provides go to declaration support.
	 *
	 * @since 3.14.0
	 */
	declarationProvider?: boolean | DeclarationOptions | DeclarationRegistrationOptions;

	/**
	 * The server provides goto definition support.
	 */
	definitionProvider?: boolean | DefinitionOptions;

	/**
	 * The server provides goto type definition support.
	 *
	 * @since 3.6.0
	 */
	typeDefinitionProvider?: boolean | TypeDefinitionOptions | TypeDefinitionRegistrationOptions;

	/**
	 * The server provides goto implementation support.
	 *
	 * @since 3.6.0
	 */
	implementationProvider?: boolean | ImplementationOptions | ImplementationRegistrationOptions;

	/**
	 * The server provides find references support.
	 */
	referencesProvider?: boolean | ReferenceOptions;

	/**
	 * The server provides document highlight support.
	 */
	documentHighlightProvider?: boolean | DocumentHighlightOptions;

	/**
	 * The server provides document symbol support.
	 */
	documentSymbolProvider?: boolean | DocumentSymbolOptions;

	/**
	 * The server provides code actions. The `CodeActionOptions` return type is only
	 * valid if the client signals code action literal support via the property
	 * `textDocument.codeAction.codeActionLiteralSupport`.
	 */
	codeActionProvider?: boolean | CodeActionOptions;

	/**
	 * The server provides code lens.
	 */
	codeLensProvider?: CodeLensOptions;

	/**
	 * The server provides document link support.
	 */
	documentLinkProvider?: DocumentLinkOptions;

	/**
	 * The server provides color provider support.
	 *
	 * @since 3.6.0
	 */
	colorProvider?: boolean | DocumentColorOptions | DocumentColorRegistrationOptions;

	/**
	 * The server provides document formatting.
	 */
	documentFormattingProvider?: boolean | DocumentFormattingOptions;

	/**
	 * The server provides document range formatting.
	 */
	documentRangeFormattingProvider?: boolean | DocumentRangeFormattingOptions;

	/**
	 * The server provides document formatting on typing.
	 */
	documentOnTypeFormattingProvider?: DocumentOnTypeFormattingOptions;

	/**
	 * The server provides rename support. RenameOptions may only be
	 * specified if the client states that it supports
	 * `prepareSupport` in its initial `initialize` request.
	 */
	renameProvider?: boolean | RenameOptions;

	/**
	 * The server provides folding provider support.
	 *
	 * @since 3.10.0
	 */
	foldingRangeProvider?: boolean | FoldingRangeOptions | FoldingRangeRegistrationOptions;

	/**
	 * The server provides execute command support.
	 */
	executeCommandProvider?: ExecuteCommandOptions;

	/**
	 * The server provides selection range support.
	 *
	 * @since 3.15.0
	 */
	selectionRangeProvider?: boolean | SelectionRangeOptions | SelectionRangeRegistrationOptions;

	/**
	 * The server provides workspace symbol support.
	 */
	workspaceSymbolProvider?: boolean;

	/**
	 * Workspace specific server capabilities
	 */
	workspace?: {
		/**
		 * The server supports workspace folder.
		 *
		 * @since 3.6.0
		 */
		workspaceFolders?: WorkspaceFoldersServerCapabilities;
	}

	/**
	 * Experimental server capabilities.
	 */
	experimental?: any;
}
```

#### 初始化通知

在客户端收到初始化请求的结果之后，但在客户端向服务器发送任何其他请求或通知之前，已初始化的通知从客户端发送到服务器。 服务器可以使用初始化的通知来动态注册功能。 初始化的通知只能发送一次。

通知：

- 方法：“已初始化”

- 参数：InitializedParams定义如下：

```
interface InitializedParams {
}
```

#### 关机请求

关闭请求从客户端发送到服务器。它要求服务器关闭，但不退出（否则可能无法将响应正确传递给客户端）。有一个单独的退出通知，要求服务器退出。除了退出或请求外，客户端不得向已向其发送关闭请求的服务器发送任何通知。如果服务器在关闭请求后接收到请求，则这些请求将出现InvalidRequest错误。

请求：

- 方法：“关机”

- 参数：无效
  

响应：

- 结果：null

- 错误：在关闭请求期间发生异常的情况下设置的代码和消息。

#### 退出通知

要求服务器退出其进程的通知。如果之前已收到关闭请求，则服务器应以成功代码0退出；否则，服务器将退出。否则，错误代码为1。

通知：

方法：“退出”
参数：无效

#### ShowMessage通知

显示消息通知从服务器发送到客户端，以要求客户端在用户界面中显示特定消息。

通知：

- 方法：“ window / showMessage”

- 参数：ShowMessageParams定义如下：

```
interface ShowMessageParams {
	/**
	 * The message type. See {@link MessageType}.
	 */
	type: number;

	/**
	 * The actual message.
	 */
	message: string;
}
```

其中类型定义如下：

```
export namespace MessageType {
	/**
	 * An error message.
	 */
	export const Error = 1;
	/**
	 * A warning message.
	 */
	export const Warning = 2;
	/**
	 * An information message.
	 */
	export const Info = 3;
	/**
	 * A log message.
	 */
	export const Log = 4;
}
```

#### ShowMessage请求

显示消息请求从服务器发送到客户端，以请求客户端在用户界面中显示特定消息。 除了显示消息通知外，该请求还允许传递操作并等待客户端的答复。

请求：

- 方法：“ window / showMessageRequest”

- 参数：ShowMessageRequestParams定义如下：

响应：

- 结果：选定的MessageActionItem | 如果未选择任何参数，则返回null。
- 错误：代码和消息集，以防在显示消息期间发生异常。

```
interface ShowMessageRequestParams {
	/**
	 * The message type. See {@link MessageType}
	 */
	type: number;

	/**
	 * The actual message
	 */
	message: string;

	/**
	 * The message action items to present.
	 */
	actions?: MessageActionItem[];
}
```

MessageActionItem的定义如下：

```
interface MessageActionItem {
	/**
	 * A short title like 'Retry', 'Open Log' etc.
	 */
	title: string;
}
```

#### LogMessage通知

日志消息通知从服务器发送到客户端，以要求客户端记录特定消息。

通知：

- 方法：“ window / logMessage”

- 参数：LogMessageParams定义如下：

```
interface LogMessageParams {
	/**
	 * The message type. See {@link MessageType}
	 */
	type: number;

	/**
	 * The actual message
	 */
	message: string;
}
```

#### 创建工作完成进度

window / workDoneProgress / create请求从服务器发送到客户端，要求客户端创建工作完成进度。

请求：

- 方法：“ window / workDoneProgress / create”

- 参数：WorkDoneProgressCreateParams定义如下：

```
export interface WorkDoneProgressCreateParams {
	/**
	 * The token to be used to report progress.
	 */
	token: ProgressToken;
}
```

响应：

- 结果：无效

- 错误：在“ window / workDoneProgress / create”请求期间发生异常的情况下设置的代码和消息。 万一发生错误，服务器不得使用WorkDoneProgressCreateParams中提供的令牌发送任何进度通知。

#### 取消工作完成进度

window / workDoneProgress / cancel通知从客户端发送到服务器，以取消使用window / workDoneProgress / create在服务器端启动的进度。

通知：

- 方法：“ window / workDoneProgress / cancel”

- 参数：WorkDoneProgressCancelParams定义如下：

```
export interface WorkDoneProgressCancelParams {
	/**
	 * The token to be used to report progress.
	 */
	token: ProgressToken;
}
```

#### 遥测通知

遥测通知从服务器发送到客户端，以要求客户端记录遥测事件。

通知：

- 方法：“遥测/事件”

- 参数：“任何”

#### 注册功能

客户端/ registerCapability请求从服务器发送到客户端，以在客户端注册新功能。并非所有客户都需要支持动态功能注册。客户端通过特定客户端功能上的dynamicRegistration属性选择加入。客户端甚至可以为功能A提供动态注册，但不能为功能B提供动态注册（请参阅TextDocumentClientCapabilities作为示例）。

服务器不能同时通过初始化结果静态注册相同的功能，也不能为同一文档选择器动态注册相同的功能。如果服务器要同时支持静态注册和动态注册，则它需要在初始化请求中检查客户端功能，并且仅在客户端不支持该功能的动态注册时才静态注册功能。

请求：

- 方法：“ client / registerCapability”

- 参数：RegistrationParams

其中RegistrationParams定义如下：

```
/**
 * General parameters to register for a capability.
 */
export interface Registration {
	/**
	 * The id used to register the request. The id can be used to deregister
	 * the request again.
	 */
	id: string;

	/**
	 * The method / capability to register for.
	 */
	method: string;

	/**
	 * Options necessary for the registration.
	 */
	registerOptions?: any;
}

export interface RegistrationParams {
	registrations: Registration[];
```

由于大多数注册选项都需要指定文档选择器，因此可以使用基本接口。 请参阅TextDocumentRegistrationOptions。

在客户端动态注册textDocument / willSaveWaitUntil功能的示例JSON RPC消息如下（仅显示详细信息）：

```
{
	"method": "client/registerCapability",
	"params": {
		"registrations": [
			{
				"id": "79eee87c-c409-4664-8102-e03263673f6f",
				"method": "textDocument/willSaveWaitUntil",
				"registerOptions": {
					"documentSelector": [
						{ "language": "javascript" }
					]
				}
			}
		]
	}
}
```

该消息从服务器发送到客户端，并且在客户端成功执行请求之后，对JavaScript文本文档的进一步textDocument / willSaveWaitUntil请求从客户端发送到服务器。

响应：

- 结果：无效。

- 错误：在请求期间发生异常的情况下设置的代码和消息。

#### 取消注册功能

客户端/ unregisterCapability请求从服务器发送到客户端，以取消注册先前注册的功能。

请求：

- 方法：“ client / unregisterCapability”

- 参数：UnregistrationParams

UnregistrationParams的定义如下：

```
/**
 * General parameters to unregister a capability.
 */
export interface Unregistration {
	/**
	 * The id used to unregister the request or notification. Usually an id
	 * provided during the register request.
	 */
	id: string;

	/**
	 * The method / capability to unregister for.
	 */
	method: string;
}

export interface UnregistrationParams {
	// This should correctly be named `unregistrations`. However changing this
	// is a breaking change and needs to wait until we deliver a 4.x version
	// of the specification.
	unregisterations: Unregistration[];
}
```

取消注册上述已注册textDocument / willSaveWaitUntil功能的示例JSON RPC消息如下所示：

```
{
	"method": "client/unregisterCapability",
	"params": {
		"unregisterations": [
			{
				"id": "79eee87c-c409-4664-8102-e03263673f6f",
				"method": "textDocument/willSaveWaitUntil"
			}
		]
	}
}
```

响应：

- 结果：无效。

- 错误：在请求期间发生异常的情况下设置的代码和消息。

#### 工作区文件夹请求



许多工具每个工作空间支持多个根文件夹。例如，VS Code的多根支持，Atom的项目文件夹支持或Sublime的项目支持。如果客户端工作空间由多个根组成，则服务器通常需要了解这一点。到目前为止，该协议假定一个根文件夹，该文件夹由InitializeParams的rootUri属性宣布给服务器。如果客户端支持工作空间文件夹并通过相应的工作空间文件夹客户端功能进行公告，则在服务器启动时，InitializeParams将包含具有配置的工作空间文件夹的附加属性workspaceFolders。

工作区/ workspaceFolders请求从服务器发送到客户端，以获取工作区文件夹的当前打开列表。如果在工具中仅打开一个文件，则在响应中返回null。如果打开了工作空间但未配置任何文件夹，则返回一个空数组。

客户能力：

- 属性路径（可选）：workspace.workspaceFolders

- 物业类型：布尔型

服务器功能：

- 属性路径（可选）：workspace.workspaceFolders
- 属性类型：WorkspaceFoldersServerCapabilities定义如下：

```
export interface WorkspaceFoldersServerCapabilities {
	/**
	 * The server has support for workspace folders
	 */
	supported?: boolean;

	/**
	 * Whether the server wants to receive workspace folder
	 * change notifications.
	 *
	 * If a string is provided, the string is treated as an ID
	 * under which the notification is registered on the client
	 * side. The ID can be used to unregister for these events
	 * using the `client/unregisterCapability` request.
	 */
	changeNotifications?: string | boolean;
}
```

请求：

- 方法：“ workspace / workspaceFolders”

- 参数：无

响应：

- 结果：WorkspaceFolder [] | null定义如下：

```
export interface WorkspaceFolder {
	/**
	 * The associated URI for this workspace folder.
	 */
	uri: DocumentUri;

	/**
	 * The name of the workspace folder. Used to refer to this
	 * workspace folder in the user interface.
	 */
	name: string;
}
```

- 错误：在“ workspace / workspaceFolders”请求期间发生异常的情况下设置的代码和消息

#### DidChangeWorkspaceFolders通知

工作区/ didChangeWorkspaceFolders通知从客户端发送到服务器，以通知服务器有关工作区文件夹配置的更改。如果客户端功能workspace.workspaceFolders和服务器功能workspace.workspaceFolders.supported为true，则默认情况下发送通知。或服务器已注册以接收此通知。要注册工作空间/ didChangeWorkspaceFolders，请从服务器向客户端发送一个客户端/ registerCapability请求。注册参数必须具有以下形式的注册项目，其中id是用于注销功能的唯一ID（该示例使用UUID）：

```
{
id：“ 28c6150c-bd7b-11e7-abc4-cec278b6b50a”，
method：“ workspace / didChangeWorkspaceFolders”
}
```


通知：

- 方法：“ workspace / didChangeWorkspaceFolders”

- 参数：DidChangeWorkspaceFoldersParams定义如下：

```
export interface DidChangeWorkspaceFoldersParams {
	/**
	 * The actual workspace folder change event.
	 */
	event: WorkspaceFoldersChangeEvent;
}

/**
 * The workspace folder change event.
 */
export interface WorkspaceFoldersChangeEvent {
	/**
	 * The array of added workspace folders
	 */
	added: WorkspaceFolder[];

	/**
	 * The array of the removed workspace folders
	 */
	removed: WorkspaceFolder[];
}
```

#### DidChangeConfiguration通知

从客户端发送到服务器的通知，用于通知配置设置的更改。

客户能力：

- 属性路径（可选）：workspace.didChangeConfiguration

- 属性类型：DidChangeConfigurationClientCapabilities定义如下：

```
export interface DidChangeConfigurationClientCapabilities {
	/**
	 * Did change configuration notification supports dynamic registration.
	 */
	dynamicRegistration?: boolean;
}
```

通知：

- 方法：“ workspace / didChangeConfiguration”，

- 参数：DidChangeConfigurationParams定义如下：

```
interface DidChangeConfigurationParams {
	/**
	 * The actual changed settings
	 */
	settings: any;
}
```

#### 配置请求

工作区/配置请求从服务器发送到客户端，以从客户端获取配置设置。该请求可以在一次往返中获取多个配置设置。返回的配置设置的顺序与传递的ConfigurationItems的顺序相对应（例如，响应中的第一个项目是params中第一个配置项目的结果）。

ConfigurationItem由要询问的配置部分和一个附加范围URI组成。要求的配置部分是由服务器定义的，不一定需要与客户端使用的配置存储相对应。因此，服务器可能会要求配置cpp.formatterOptions，但是客户端将配置以不同的方式存储在XML存储布局中。由客户来进行必要的转换。如果提供了范围URI，则客户端应返回范围为提供的资源的设置。例如，如果客户端使用EditorConfig来管理其设置，则应为传递的资源URI返回配置。如果客户端无法提供给定范围的配置设置，则返回的数组中必须为空。

客户能力：

- 属性路径（可选）：workspace.configuration

- 物业类型：布尔型

请求：

- 方法：“工作区/配置”

- 参数：ConfigurationParams定义如下

```
export interface ConfigurationParams {
	items: ConfigurationItem[];
}

export interface ConfigurationItem {
	/**
	 * The scope to get the configuration section for.
	 */
	scopeUri?: DocumentUri;

	/**
	 * The configuration section asked for.
	 */
	section?: string;
}
```

- 结果：任何[]

- 错误：在“工作区/配置”请求期间发生异常的情况下设置的代码和消息

#### DidChangeWatchedFiles通知

当客户端检测到语言客户端所监视文件的更改时，已监视文件通知将从客户端发送到服务器。建议服务器使用注册机制为这些文件事件注册。在以前的实现中，客户端在没有服务器主动请求的情况下推送了文件事件。

允许服务器运行自己的文件监视机制，而不依赖客户端提供文件事件。但是，由于以下原因，不建议这样做：

根据我们的经验，正确地在磁盘上观看文件非常具有挑战性，特别是如果需要在多个操作系统之间进行支持时。
文件观看不是自由的，尤其是当实现使用某种轮询并将文件树保留在内存中以比较时间戳时（例如某些节点模块会这样做）
客户端通常启动多个服务器。如果每个服务器都运行自己的文件，则它可能会成为CPU或内存问题。
通常，服务器比客户端实现更多。因此，可以在客户端更好地解决此问题。
客户能力：

- 属性路径（可选）：workspace.didChangeWatchedFiles

- 属性类型：DidChangeWatchedFilesClientCapabilities定义如下：

```
export interface DidChangeWatchedFilesClientCapabilities {
	/**
	 * Did change watched files notification supports dynamic registration. Please note
	 * that the current protocol doesn't support static configuration for file changes
	 * from the server side.
	 */
	dynamicRegistration?: boolean;
}
```

- 注册选项：DidChangeWatchedFilesRegistrationOptions定义如下：

```
/**
 * Describe options to be used when registering for file system change events.
 */
export interface DidChangeWatchedFilesRegistrationOptions {
	/**
	 * The watchers to register.
	 */
	watchers: FileSystemWatcher[];
}

export interface FileSystemWatcher {
	/**
	 * The  glob pattern to watch.
	 *
	 * Glob patterns can have the following syntax:
	 * - `*` to match one or more characters in a path segment
	 * - `?` to match on one character in a path segment
	 * - `**` to match any number of path segments, including none
	 * - `{}` to group conditions (e.g. `**/*.{ts,js}` matches all TypeScript and JavaScript files)
	 * - `[]` to declare a range of characters to match in a path segment (e.g., `example.[0-9]` to match on `example.0`, `example.1`, …)
	 * - `[!...]` to negate a range of characters to match in a path segment (e.g., `example.[!0-9]` to match on `example.a`, `example.b`, but not `example.0`)
	 */
	globPattern: string;

	/**
	 * The kind of events of interest. If omitted it defaults
	 * to WatchKind.Create | WatchKind.Change | WatchKind.Delete
	 * which is 7.
	 */
	kind?: number;
}

export namespace WatchKind {
	/**
	 * Interested in create events.
	 */
	export const Create = 1;

	/**
	 * Interested in change events
	 */
	export const Change = 2;

	/**
	 * Interested in delete events
	 */
	export const Delete = 4;
}
```

通知：

- 方法：“ workspace / didChangeWatchedFiles”

- 参数：DidChangeWatchedFilesParams定义如下：

```
interface DidChangeWatchedFilesParams {
	/**
	 * The actual file events.
	 */
	changes: FileEvent[];
}
```

其中FileEvents的描述如下：

```
/**
 * An event describing a file change.
 */
interface FileEvent {
	/**
	 * The file's URI.
	 */
	uri: DocumentUri;
	/**
	 * The change type.
	 */
	type: number;
}

/**
 * The file event type.
 */
export namespace FileChangeType {
	/**
	 * The file got created.
	 */
	export const Created = 1;
	/**
	 * The file got changed.
	 */
	export const Changed = 2;
	/**
	 * The file got deleted.
	 */
	export const Deleted = 3;
}
```

#### 工作区符号请求

工作区符号请求从客户端发送到服务器，以列出与查询字符串匹配的项目范围内的符号。

客户能力：

- 属性路径（可选）：workspace.symbol

- 属性类型：WorkspaceSymbolClientCapabilities定义如下：

```
interface WorkspaceSymbolClientCapabilities {
	/**
	 * Symbol request supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * Specific capabilities for the `SymbolKind` in the `workspace/symbol` request.
	 */
	symbolKind?: {
		/**
		 * The symbol kind values the client supports. When this
		 * property exists the client also guarantees that it will
		 * handle values outside its set gracefully and falls back
		 * to a default value when unknown.
		 *
		 * If this property is not present the client only supports
		 * the symbol kinds from `File` to `Array` as defined in
		 * the initial version of the protocol.
		 */
		valueSet?: SymbolKind[];
	}
}
```

服务器功能：

- 属性路径（可选）：workspaceSymbolProvider

- 物业类型：布尔值| WorkspaceSymbolOptions，定义如下的WorkspaceSymbolOptions：

```
export interface WorkspaceSymbolOptions extends WorkDoneProgressOptions {
}
```

注册选项：WorkspaceSymbolRegistrationOptions定义如下：

```
export interface WorkspaceSymbolRegistrationOptions extends WorkspaceSymbolOptions {
}
```

请求：

- 方法：“工作区/符号”

- 参数：WorkspaceSymbolParams定义如下：

```
/**
 * The parameters of a Workspace Symbol Request.
 */
interface WorkspaceSymbolParams extends WorkDoneProgressParams, PartialResultParams {
	/**
	 * A query string to filter symbols by. Clients may send an empty
	 * string here to request all symbols.
	 */
	query: string;
}
```

响应：

- 结果：SymbolInformation [] | 如上所述的null。

- 部分结果：如上定义的SymbolInformation []。

- 错误：代码和消息集，以防在工作区符号请求期间发生异常。

#### 执行命令

工作空间/ executeCommand请求从客户端发送到服务器，以触发服务器上的命令执行。 在大多数情况下，服务器会创建WorkspaceEdit结构，并使用从服务器发送到客户端的请求工作空间/ applyEdit将更改应用于工作空间。

客户能力：

- 属性路径（可选）：workspace.executeCommand

- 属性类型：ExecuteCommandClientCapabilities定义如下：

```
export interface ExecuteCommandClientCapabilities {
	/**
	 * Execute command supports dynamic registration.
	 */
	dynamicRegistration?: boolean;
}
```

服务器功能：

- 属性路径（可选）：executeCommandProvider

- 属性类型：ExecuteCommandOptions定义如下：

```
export interface ExecuteCommandOptions extends WorkDoneProgressOptions {
	/**
	 * The commands to be executed on the server
	 */
	commands: string[]
}
```

注册选项：ExecuteCommandRegistrationOptions定义如下：

```
/**
 * Execute command registration options.
 */
export interface ExecuteCommandRegistrationOptions extends ExecuteCommandOptions {
}
```

请求：

- 方法：“ workspace / executeCommand”

- 参数：ExecuteCommandParams定义如下：

```
export interface ExecuteCommandParams extends WorkDoneProgressParams {

	/**
	 * The identifier of the actual command handler.
	 */
	command: string;
	/**
	 * Arguments that the command should be invoked with.
	 */
	arguments?: any[];
}
```

通常在从服务器向客户端返回命令时指定参数。 返回命令的示例请求为textDocument / codeAction或textDocument / codeLens。

响应：

- 结果：任何| 空值 (any|null)

- 错误：在请求期间发生异常的情况下设置的代码和消息。

#### 应用WorkspaceEdit（：arrow_right_hook :)

工作区/ applyEdit请求从服务器发送到客户端，以在客户端上修改资源。

客户能力：

属性路径（可选）：workspace.applyEdit
物业类型：布尔型
另请参阅WorkspaceEditClientCapabilities以获取工作区编辑的受支持功能。

请求：

- 方法：“ workspace / applyEdit”

- 参数：ApplyWorkspaceEditParams定义如下：

```
export interface ApplyWorkspaceEditParams {
	/**
	 * An optional label of the workspace edit. This label is
	 * presented in the user interface for example on an undo
	 * stack to undo the workspace edit.
	 */
	label?: string;

	/**
	 * The edits to apply.
	 */
	edit: WorkspaceEdit;
}
```

响应：

结果：ApplyWorkspaceEditResponse定义如下：

```
export interface ApplyWorkspaceEditResponse {
	/**
	 * Indicates whether the edit was applied or not.
	 */
	applied: boolean;

	/**
	 * An optional textual description for why the edit was not applied.
	 * This may be used may be used by the server for diagnostic
	 * logging or to provide a suitable error for a request that
	 * triggered the edit.
	 */
	failureReason?: string;
}
```

- 错误：在请求期间发生异常的情况下设置的代码和消息。

#### 文字文件同步

在协议中，客户端必须支持textDocument / open，textDocument / change和textDocument / close通知，并且客户端不能选择不支持它们。 另外，服务器必须实现这三个功能，或者不执行任何一个。 因此，它们的功能是通过客户端和服务器功能的组合来控制的。

客户能力：

- 属性路径（可选）：textDocument.synchronization.dynamicRegistration

- 物业类型：布尔型

控制文本文档同步是否支持动态注册。

服务器功能：

- 属性路径（可选）：textDocumentSync

- 属性类型：TextDocumentSyncKind | TextDocumentSyncOptions。 TextDocumentSyncOptions的以下定义仅涵盖特定于打开，更改和关闭通知的属性。 可以在这里找到涵盖所有属性的完整定义：

```
/**
 * Defines how the host (editor) should sync document changes to the language server.
 */
export namespace TextDocumentSyncKind {
	/**
	 * Documents should not be synced at all.
	 */
	export const None = 0;

	/**
	 * Documents are synced by always sending the full content
	 * of the document.
	 */
	export const Full = 1;

	/**
	 * Documents are synced by sending the full content on open.
	 * After that only incremental updates to the document are
	 * send.
	 */
	export const Incremental = 2;
}

export interface TextDocumentSyncOptions {
	/**
	 * Open and close notifications are sent to the server. If omitted open close notification should not
	 * be sent.
	 */
	openClose?: boolean;

	/**
	 * Change notifications are sent to the server. See TextDocumentSyncKind.None, TextDocumentSyncKind.Full
	 * and TextDocumentSyncKind.Incremental. If omitted it defaults to TextDocumentSyncKind.None.
	 */
	change?: TextDocumentSyncKind;
}
```

#### DidOpenTextDocument通知

文档打开通知从客户端发送到服务器，以信号通知新打开的文本文档。现在，文档的内容由客户端管理，并且服务器不得尝试使用文档的Uri读取文档的内容。从这个意义上讲，开放意味着它是由客户端管理的。不一定意味着它的内容是在编辑器中呈现的。在未发送相应的关闭通知之前，打开通知不得发送多次。这意味着打开和关闭通知必须保持平衡，并且特定textDocument的最大打开计数为1。请注意，服务器执行请求的能力与打开或关闭文本文档无关。

DidOpenTextDocumentParams包含与文档关联的语言ID。如果文档的语言ID发生更改，则客户端需要向服务器发送一个textDocument / didClose，然后向服务器发送一个带有新语言ID的textDocument / didOpen（如果服务器也处理新的语言ID）。

客户端功能：请参阅常规同步客户端功能。

服务器功能：请参阅常规同步服务器功能。

注册选项：TextDocumentRegistrationOptions

通知：

- 方法：“ textDocument / didOpen”

- 参数：DidOpenTextDocumentParams定义如下：

```
interface DidOpenTextDocumentParams {
	/**
	 * The document that was opened.
	 */
	textDocument: TextDocumentItem;
}
```

DidChangeTextDocument通知（：arrow_right :)
文档更改通知从客户端发送到服务器，以信号通知对文本文档的更改。 客户必须先使用textDocument / didOpen通知声明其内容的所有权，然后客户才能更改文本文档。 在2.0中，参数的形状已更改为包括正确的版本号和语言ID。

客户端功能：请参阅常规同步客户端功能。

服务器功能：请参阅常规同步服务器功能。

注册选项：TextDocumentChangeRegistrationOptions定义如下：

```
/**
 * Describe options to be used when registering for text document change events.
 */
export interface TextDocumentChangeRegistrationOptions extends TextDocumentRegistrationOptions {
	/**
	 * How documents are synced to the server. See TextDocumentSyncKind.Full
	 * and TextDocumentSyncKind.Incremental.
	 */
	syncKind: TextDocumentSyncKind;
}
```

通知：

- 方法：“ textDocument / didChange”

- 参数：DidChangeTextDocumentParams定义如下：

```
interface DidChangeTextDocumentParams {
	/**
	 * The document that did change. The version number points
	 * to the version after all provided content changes have
	 * been applied.
	 */
	textDocument: VersionedTextDocumentIdentifier;

	/**
	 * The actual content changes. The content changes describe single state changes
	 * to the document. So if there are two content changes c1 (at array index 0) and
	 * c2 (at array index 1) for a document in state S then c1 moves the document from
	 * S to S' and c2 from S' to S''. So c1 is computed on the state S and c2 is computed
	 * on the state S'.
	 *
	 * To mirror the content of a document using change events use the following approach:
	 * - start with the same initial content
	 * - apply the 'textDocument/didChange' notifications in the order you recevie them.
	 * - apply the `TextDocumentContentChangeEvent`s in a single notification in the order
	 *   you receive them.
	 */
	contentChanges: TextDocumentContentChangeEvent[];
}

/**
 * An event describing a change to a text document. If range and rangeLength are omitted
 * the new text is considered to be the full content of the document.
 */
export type TextDocumentContentChangeEvent = {
	/**
	 * The range of the document that changed.
	 */
	range: Range;

	/**
	 * The optional length of the range that got replaced.
	 *
	 * @deprecated use range instead.
	 */
	rangeLength?: number;

	/**
	 * The new text for the provided range.
	 */
	text: string;
} | {
	/**
	 * The new text of the whole document.
	 */
	text: string;
}
```

#### WillSaveTextDocument通知

实际保存文档之前，文档将保存通知从客户端发送到服务器。

客户能力：

- 属性名称（可选）：textDocument.synchronization.willSave

- 物业类型：布尔型

该功能指示客户端支持textDocument / willSave通知。

服务器功能：

- 属性名称（可选）：textDocumentSync.willSave

- 物业类型：布尔型

该功能表明服务器对textDocument / willSave通知感兴趣。

注册选项：TextDocumentRegistrationOptions

通知：

- 方法：“ textDocument / willSave”

- 参数：WillSaveTextDocumentParams定义如下：

```
/**
 * The parameters send in a will save text document notification.
 */
export interface WillSaveTextDocumentParams {
	/**
	 * The document that will be saved.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The 'TextDocumentSaveReason'.
	 */
	reason: number;
}

/**
 * Represents reasons why a text document is saved.
 */
export namespace TextDocumentSaveReason {

	/**
	 * Manually triggered, e.g. by the user pressing save, by starting debugging,
	 * or by an API call.
	 */
	export const Manual = 1;

	/**
	 * Automatic after a delay.
	 */
	export const AfterDelay = 2;

	/**
	 * When the editor lost focus.
	 */
	export const FocusOut = 3;
}
```

#### WillSaveWaitUntilTextDocument请求

实际保存文档之前，文档将保存请求从客户端发送到服务器。该请求可以返回一个TextEdits数组，该数组将在保存之前应用于文本文档。请注意，如果计算文本编辑的时间太长或服务器在此请求下持续失败，则客户端可能会丢弃结果。这样做是为了保持保存快速可靠。

客户能力：

- 属性名称（可选）：textDocument.synchronization.willSaveWaitUntil

- 物业类型：布尔型

该功能指示客户端支持textDocument / willSaveWaitUntil请求。

服务器功能：

- 属性名称（可选）：textDocumentSync.willSaveWaitUntil

- 物业类型：布尔型

该功能表明服务器对textDocument / willSaveWaitUntil请求感兴趣。

注册选项：TextDocumentRegistrationOptions

请求：

- 方法：“ textDocument / willSaveWaitUntil”

- 参数：WillSaveTextDocumentParams

响应：

- 结果：TextEdit [] |空值

- 错误：将在willSaveWaitUntil请求期间发生异常的情况下设置代码和消息。

#### DidSaveTextDocument通知

当文档保存在客户端中时，文档保存通知将从客户端发送到服务器。

客户能力：

- 属性名称（可选）：textDocument.synchronization.didSave

- 物业类型：布尔型

该功能指示客户端支持textDocument / didSave通知。

服务器功能：

- 属性名称（可选）：textDocumentSync.didSave

- 物业类型：布尔值| SaveOptions的定义如下：

```
export interface SaveOptions {
	/**
	 * The client is supposed to include the content on save.
	 */
	includeText?: boolean;
}
```

该功能表明服务器对textDocument / didSave通知感兴趣。

注册选项：TextDocumentSaveRegistrationOptions定义如下：

```
export interface TextDocumentSaveRegistrationOptions extends TextDocumentRegistrationOptions {
	/**
	 * The client is supposed to include the content on save.
	 */
	includeText?: boolean;
}
```

通知：

- 方法：“ textDocument / didSave”

- 参数：DidSaveTextDocumentParams定义如下：

```
interface DidSaveTextDocumentParams {
	/**
	 * The document that was saved.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * Optional the content when saved. Depends on the includeText value
	 * when the save notification was requested.
	 */
	text?: string;
}
```

#### DidCloseTextDocument通知

当文档在客户端中关闭时，文档关闭通知将从客户端发送到服务器。 该文档的母版现在位于文档的Uri指向的位置（例如，如果文档的Uri是文件Uri，则该母版现在位于磁盘上）。 与打开通知一样，关闭通知也是关于管理文档内容的。 收到关闭通知并不意味着该文档之前已在编辑器中打开。 关闭通知要求发送先前的打开通知。 请注意，服务器执行请求的能力与打开或关闭文本文档无关。

客户端功能：请参阅常规同步客户端功能。

服务器功能：请参阅常规同步服务器功能。

注册选项：TextDocumentRegistrationOptions

通知：

- 方法：“ textDocument / didClose”

- 参数：DidCloseTextDocumentParams定义如下：

```
interface DidCloseTextDocumentParams {
	/**
	 * The document that was closed.
	 */
	textDocument: TextDocumentIdentifier;
}
```

TextDocumentSyncClientCapabilities和TextDocumentSyncOptions服务器选项的最终结构如下所示

```
export interface TextDocumentSyncClientCapabilities {
	/**
	 * Whether text document synchronization supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports sending will save notifications.
	 */
	willSave?: boolean;

	/**
	 * The client supports sending a will save request and
	 * waits for a response providing text edits which will
	 * be applied to the document before it is saved.
	 */
	willSaveWaitUntil?: boolean;

	/**
	 * The client supports did save notifications.
	 */
	didSave?: boolean;
}

/**
 * Defines how the host (editor) should sync document changes to the language server.
 */
export namespace TextDocumentSyncKind {
	/**
	 * Documents should not be synced at all.
	 */
	export const None = 0;

	/**
	 * Documents are synced by always sending the full content
	 * of the document.
	 */
	export const Full = 1;

	/**
	 * Documents are synced by sending the full content on open.
	 * After that only incremental updates to the document are
	 * send.
	 */
	export const Incremental = 2;
}

export interface TextDocumentSyncOptions {
	/**
	 * Open and close notifications are sent to the server. If omitted open close notification should not
	 * be sent.
	 */
	openClose?: boolean;
	/**
	 * Change notifications are sent to the server. See TextDocumentSyncKind.None, TextDocumentSyncKind.Full
	 * and TextDocumentSyncKind.Incremental. If omitted it defaults to TextDocumentSyncKind.None.
	 */
	change?: number;
	/**
	 * If present will save notifications are sent to the server. If omitted the notification should not be
	 * sent.
	 */
	willSave?: boolean;
	/**
	 * If present will save wait until requests are sent to the server. If omitted the request should not be
	 * sent.
	 */
	willSaveWaitUntil?: boolean;
	/**
	 * If present save notifications are sent to the server. If omitted the notification should not be
	 * sent.
	 */
	save?: SaveOptions;
}
```

#### PublishDiagnostics通知

诊断通知从服务器发送到客户端，以发出验证运行的结果。

诊断由服务器“拥有”，因此服务器有责任在必要时清除它们。以下规则用于生成诊断的VS Code服务器：

如果语言仅是单个文件（例如HTML），则关闭文件后服务器将清除诊断。
如果一种语言具有项目系统（例如C＃），则在关闭文件时不会清除诊断。打开项目时，将重新计算所有文件的所有诊断（或从缓存中读取）。
文件更改后，服务器有责任重新计算诊断并将其推送到客户端。如果计算集为空，则必须推送空数组以清除以前的诊断。新推送的诊断程序始终会替换以前推送的诊断程序。在客户端没有发生合并。

另请参阅诊断部分。

客户能力：

- 属性名称（可选）：textDocument.publishDiagnostics

- 属性类型PublishDiagnosticsClientCapabilities定义如下：

```
export interface PublishDiagnosticsClientCapabilities {
	/**
	 * Whether the clients accepts diagnostics with related information.
	 */
	relatedInformation?: boolean;

	/**
	 * Client supports the tag property to provide meta data about a diagnostic.
	 * Clients supporting tags have to handle unknown tags gracefully.
	 *
	 * @since 3.15.0
	 */
	tagSupport?: {
		/**
		 * The tags supported by the client.
		 */
		valueSet: DiagnosticTag[];
	};

	/**
	 * Whether the client interprets the version property of the
	 * `textDocument/publishDiagnostics` notification's parameter.
	 *
	 * @since 3.15.0
	 */
	versionSupport?: boolean;
}
```

通知：

- 方法：“ textDocument / publishDiagnostics”

- 参数：PublishDiagnosticsParams定义如下：

```
interface PublishDiagnosticsParams {
	/**
	 * The URI for which diagnostic information is reported.
	 */
	uri: DocumentUri;

	/**
	 * Optional the version number of the document the diagnostics are published for.
	 *
	 * @since 3.15.0
	 */
	version?: number;

	/**
	 * An array of diagnostic information items.
	 */
	diagnostics: Diagnostic[];
}
```

#### 完成请求

完成请求从客户端发送到服务器，以计算给定光标位置处的完成项目。完成项目在IntelliSense用户界面中显示。如果计算完整的完成项目非常昂贵，则服务器可以另外提供一个处理程序，用于完成项目解决请求（“ completionItem / resolve”）。在用户界面中选择完成项目时，将发送此请求。例如，一个典型的用例是：“ textDocument / completion”请求未填写返回的完成项目的documentation属性，因为计算成本很高。在用户界面中选择项目后，系统会发送“ completionItem / resolve”请求，并以选定的完成项目作为参数。返回的完成项目应填充了documentation属性。请求只能延迟详细信息和documentation属性的计算。必须在textDocument / completion响应中提供其他属性，例如sortText，filterText，insertText，textEdit和AdditionalTextEdits，并且在解析过程中不得更改它们。

客户能力：

- 属性名称（可选）：textDocument.completion

- 属性类型：CompletionClientCapabilities定义如下：

```
export interface CompletionClientCapabilities {
	/**
	 * Whether completion supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports the following `CompletionItem` specific
	 * capabilities.
	 */
	completionItem?: {
		/**
		 * Client supports snippets as insert text.
		 *
		 * A snippet can define tab stops and placeholders with `$1`, `$2`
		 * and `${3:foo}`. `$0` defines the final tab stop, it defaults to
		 * the end of the snippet. Placeholders with equal identifiers are linked,
		 * that is typing in one will update others too.
		 */
		snippetSupport?: boolean;

		/**
		 * Client supports commit characters on a completion item.
		 */
		commitCharactersSupport?: boolean

		/**
		 * Client supports the follow content formats for the documentation
		 * property. The order describes the preferred format of the client.
		 */
		documentationFormat?: MarkupKind[];

		/**
		 * Client supports the deprecated property on a completion item.
		 */
		deprecatedSupport?: boolean;

		/**
		 * Client supports the preselect property on a completion item.
		 */
		preselectSupport?: boolean;

		/**
		 * Client supports the tag property on a completion item. Clients supporting
		 * tags have to handle unknown tags gracefully. Clients especially need to
		 * preserve unknown tags when sending a completion item back to the server in
		 * a resolve call.
		 *
		 * @since 3.15.0
		 */
		tagSupport?: {
			/**
			 * The tags supported by the client.
			 */
			valueSet: CompletionItemTag[]
		}
	};

	completionItemKind?: {
		/**
		 * The completion item kind values the client supports. When this
		 * property exists the client also guarantees that it will
		 * handle values outside its set gracefully and falls back
		 * to a default value when unknown.
		 *
		 * If this property is not present the client only supports
		 * the completion items kinds from `Text` to `Reference` as defined in
		 * the initial version of the protocol.
		 */
		valueSet?: CompletionItemKind[];
	};

	/**
	 * The client supports to send additional context information for a
	 * `textDocument/completion` request.
	 */
	contextSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：complementProvider

- 属性类型：CompletionOptions定义如下：

```
/**
 * Completion options.
 */
export interface CompletionOptions extends WorkDoneProgressOptions {
	/**
	 * Most tools trigger completion request automatically without explicitly requesting
	 * it using a keyboard shortcut (e.g. Ctrl+Space). Typically they do so when the user
	 * starts to type an identifier. For example if the user types `c` in a JavaScript file
	 * code complete will automatically pop up present `console` besides others as a
	 * completion item. Characters that make up identifiers don't need to be listed here.
	 *
	 * If code complete should automatically be trigger on characters not being valid inside
	 * an identifier (for example `.` in JavaScript) list them in `triggerCharacters`.
	 */
	triggerCharacters?: string[];

	/**
	 * The list of all possible characters that commit a completion. This field can be used
	 * if clients don't support individual commit characters per completion item. See
	 * `ClientCapabilities.textDocument.completion.completionItem.commitCharactersSupport`.
	 *
	 * If a server provides both `allCommitCharacters` and commit characters on an individual
	 * completion item the ones on the completion item win.
	 *
	 * @since 3.2.0
	 */
	allCommitCharacters?: string[];

	/**
	 * The server provides support to resolve additional
	 * information for a completion item.
	 */
	resolveProvider?: boolean;
}
```

注册选项：CompletionRegistrationOptions选项定义如下：

```
export interface CompletionRegistrationOptions extends TextDocumentRegistrationOptions, CompletionOptions {
}
```

请求：

- 方法：“ textDocument / completion”

- 参数：CompletionParams定义如下：

```
export interface CompletionParams extends TextDocumentPositionParams, WorkDoneProgressParams, PartialResultParams {
	/**
	 * The completion context. This is only available if the client specifies
	 * to send this using `ClientCapabilities.textDocument.completion.contextSupport === true`
	 */
	context?: CompletionContext;
}

/**
 * How a completion was triggered
 */
export namespace CompletionTriggerKind {
	/**
	 * Completion was triggered by typing an identifier (24x7 code
	 * complete), manual invocation (e.g Ctrl+Space) or via API.
	 */
	export const Invoked: 1 = 1;

	/**
	 * Completion was triggered by a trigger character specified by
	 * the `triggerCharacters` properties of the `CompletionRegistrationOptions`.
	 */
	export const TriggerCharacter: 2 = 2;

	/**
	 * Completion was re-triggered as the current completion list is incomplete.
	 */
	export const TriggerForIncompleteCompletions: 3 = 3;
}
export type CompletionTriggerKind = 1 | 2 | 3;


/**
 * Contains additional information about the context in which a completion request is triggered.
 */
export interface CompletionContext {
	/**
	 * How the completion was triggered.
	 */
	triggerKind: CompletionTriggerKind;

	/**
	 * The trigger character (a single character) that has trigger code complete.
	 * Is undefined if `triggerKind !== CompletionTriggerKind.TriggerCharacter`
	 */
	triggerCharacter?: string;
}
```

响应：

- 结果：CompletionItem [] | 完成列表| 空值。 如果提供了CompletionItem []，则将其解释为完整的。 因此它与{isIncomplete：false，items}相同

```
/**
 * Represents a collection of [completion items](#CompletionItem) to be presented
 * in the editor.
 */
export interface CompletionList {
	/**
	 * This list it not complete. Further typing should result in recomputing
	 * this list.
	 */
	isIncomplete: boolean;

	/**
	 * The completion items.
	 */
	items: CompletionItem[];
}

/**
 * Defines whether the insert text in a completion item should be interpreted as
 * plain text or a snippet.
 */
export namespace InsertTextFormat {
	/**
	 * The primary text to be inserted is treated as a plain string.
	 */
	export const PlainText = 1;

	/**
	 * The primary text to be inserted is treated as a snippet.
	 *
	 * A snippet can define tab stops and placeholders with `$1`, `$2`
	 * and `${3:foo}`. `$0` defines the final tab stop, it defaults to
	 * the end of the snippet. Placeholders with equal identifiers are linked,
	 * that is typing in one will update others too.
	 */
	export const Snippet = 2;
}

export type InsertTextFormat = 1 | 2;

/**
 * Completion item tags are extra annotations that tweak the rendering of a completion
 * item.
 *
 * @since 3.15.0
 */
export namespace CompletionItemTag {
	/**
	 * Render a completion as obsolete, usually using a strike-out.
	 */
	export const Deprecated = 1;
}

export type CompletionItemTag = 1;

export interface CompletionItem {
	/**
	 * The label of this completion item. By default
	 * also the text that is inserted when selecting
	 * this completion.
	 */
	label: string;

	/**
	 * The kind of this completion item. Based of the kind
	 * an icon is chosen by the editor. The standardized set
	 * of available values is defined in `CompletionItemKind`.
	 */
	kind?: number;

	/**
	 * Tags for this completion item.
	 *
	 * @since 3.15.0
	 */
	tags?: CompletionItemTag[];

	/**
	 * A human-readable string with additional information
	 * about this item, like type or symbol information.
	 */
	detail?: string;

	/**
	 * A human-readable string that represents a doc-comment.
	 */
	documentation?: string | MarkupContent;

	/**
	 * Indicates if this item is deprecated.
	 *
	 * @deprecated Use `tags` instead if supported.
	 */
	deprecated?: boolean;

	/**
	 * Select this item when showing.
	 *
	 * *Note* that only one completion item can be selected and that the
	 * tool / client decides which item that is. The rule is that the *first*
	 * item of those that match best is selected.
	 */
	preselect?: boolean;

	/**
	 * A string that should be used when comparing this item
	 * with other items. When `falsy` the label is used.
	 */
	sortText?: string;

	/**
	 * A string that should be used when filtering a set of
	 * completion items. When `falsy` the label is used.
	 */
	filterText?: string;

	/**
	 * A string that should be inserted into a document when selecting
	 * this completion. When `falsy` the label is used.
	 *
	 * The `insertText` is subject to interpretation by the client side.
	 * Some tools might not take the string literally. For example
	 * VS Code when code complete is requested in this example `con<cursor position>`
	 * and a completion item with an `insertText` of `console` is provided it
	 * will only insert `sole`. Therefore it is recommended to use `textEdit` instead
	 * since it avoids additional client side interpretation.
	 */
	insertText?: string;

	/**
	 * The format of the insert text. The format applies to both the `insertText` property
	 * and the `newText` property of a provided `textEdit`. If omitted defaults to
	 * `InsertTextFormat.PlainText`.
	 */
	insertTextFormat?: InsertTextFormat;

	/**
	 * An edit which is applied to a document when selecting this completion. When an edit is provided the value of
	 * `insertText` is ignored.
	 *
	 * *Note:* The range of the edit must be a single line range and it must contain the position at which completion
	 * has been requested.
	 */
	textEdit?: TextEdit;

	/**
	 * An optional array of additional text edits that are applied when
	 * selecting this completion. Edits must not overlap (including the same insert position)
	 * with the main edit nor with themselves.
	 *
	 * Additional text edits should be used to change text unrelated to the current cursor position
	 * (for example adding an import statement at the top of the file if the completion item will
	 * insert an unqualified type).
	 */
	additionalTextEdits?: TextEdit[];

	/**
	 * An optional set of characters that when pressed while this completion is active will accept it first and
	 * then type that character. *Note* that all commit characters should have `length=1` and that superfluous
	 * characters will be ignored.
	 */
	commitCharacters?: string[];

	/**
	 * An optional command that is executed *after* inserting this completion. *Note* that
	 * additional modifications to the current document should be described with the
	 * additionalTextEdits-property.
	 */
	command?: Command;

	/**
	 * A data entry field that is preserved on a completion item between
	 * a completion and a completion resolve request.
	 */
	data?: any
}

/**
 * The kind of a completion entry.
 */
export namespace CompletionItemKind {
	export const Text = 1;
	export const Method = 2;
	export const Function = 3;
	export const Constructor = 4;
	export const Field = 5;
	export const Variable = 6;
	export const Class = 7;
	export const Interface = 8;
	export const Module = 9;
	export const Property = 10;
	export const Unit = 11;
	export const Value = 12;
	export const Enum = 13;
	export const Keyword = 14;
	export const Snippet = 15;
	export const Color = 16;
	export const File = 17;
	export const Reference = 18;
	export const Folder = 19;
	export const EnumMember = 20;
	export const Constant = 21;
	export const Struct = 22;
	export const Event = 23;
	export const Operator = 24;
	export const TypeParameter = 25;
}
```

- 部分结果：CompletionItem []或CompletionList，然后是CompletionItem []。如果提供的第一个结果项是CompletionList类型，则CompletionItem []的后续部分结果将添加到CompletionList的items属性中。

- 错误：在完成请求期间发生异常的情况下设置的代码和消息。

完成项支持代码段（请参见InsertTextFormat.Snippet）。片段格式如下：

#### 片段语法

摘要的正文可以使用特殊的结构来控制光标和所插入的文本。以下是受支持的功能及其语法：

#### 制表位

使用制表位，可以使编辑器光标在摘要中移动。使用$ 1，$ 2指定光标位置。数字是跳位停靠点的访问顺序，而$ 0表示最终光标位置。多个制表位被链接并同步更新。

#### 占位符

占位符是带有值的制表位，例如$ {1：foo}。将插入并选择占位符文本，以便可以轻松更改它。可以嵌套占位符，例如$ {1：另一个$ {2：placeholder}}。

#### 选择

占位符可以选择作为值。语法是用逗号分隔的值的枚举，并用管道字符括起来，例如$ {1 | one，two，three |}。插入代码段并选择占位符后，选项将提示用户选择其中一个值。

#### 变量

使用$ name或$ {name：default}可以插入变量的值。如果未设置变量，则会插入其默认值或空字符串。当变量未知（即未定义其名称）时，将插入该变量的名称，并将其转换为占位符。

可以使用以下变量：

- TM_SELECTED_TEXT当前选择的文本或空字符串

- TM_CURRENT_LINE当前行的内容

- TM_CURRENT_WORD光标下的单词或空字符串的内容

- TM_LINE_INDEX基于零索引的行号

- TM_LINE_NUMBER基于一索引的行号

- TM_FILENAME当前文档的文件名

- TM_FILENAME_BASE当前文档的文件名，不带扩展名

- TM_DIRECTORY当前文档的目录

- TM_FILEPATH当前文档的完整文件路径

#### 变量转换

转换允许您在插入变量之前修改其值。转换的定义包括三个部分：

- 与变量值匹配的正则表达式，或者在无法解析变量时为空字符串。

- 一个“格式字符串”，允许从正则表达式中引用匹配的组。格式字符串允许条件插入和简单修改。

- 传递给正则表达式的选项。

下面的示例插入当前文件的名称而没有结尾，因此从foo.txt中将其制成foo。

```
${TM_FILENAME/(.*)\..+$/$1/}
  |           |         | |
  |           |         | |-> no options
  |           |         |
  |           |         |-> references the contents of the first
  |           |             capture group
  |           |
  |           |-> regex to capture everything before
  |               the final `.suffix`
  |
  |-> resolves to the filename
```

#### 语法

以下是摘要的EBNF（扩展的Backus-Naur形式）。 使用\（反斜杠），可以转义$，}和\。 在选择元素中，反斜杠还会转义逗号和竖线字符。

```
any         ::= tabstop | placeholder | choice | variable | text
tabstop     ::= '$' int | '${' int '}'
placeholder ::= '${' int ':' any '}'
choice      ::= '${' int '|' text (',' text)* '|}'
variable    ::= '$' var | '${' var }'
                | '${' var ':' any '}'
                | '${' var '/' regex '/' (format | text)+ '/' options '}'
format      ::= '$' int | '${' int '}'
                | '${' int ':' '/upcase' | '/downcase' | '/capitalize' '}'
                | '${' int ':+' if '}'
                | '${' int ':?' if ':' else '}'
                | '${' int ':-' else '}' | '${' int ':' else '}'
regex       ::= JavaScript Regular Expression value (ctor-string)
options     ::= JavaScript Regular Expression option (ctor-options)
var         ::= [_a-zA-Z] [_a-zA-Z0-9]*
int         ::= [0-9]+
text        ::= .*
```

#### 完成项目解析请求

该请求从客户端发送到服务器，以解析给定完成项目的其他信息。

请求：

- 方法：“ completionItem / resolve”

- 参数：CompletionItem

响应：

- 结果：CompletionItem

- 错误：在完成解决请求期间发生异常的情况下设置的代码和消息。

#### 悬停请求

悬停请求从客户端发送到服务器，以在给定的文本文档位置请求悬停信息。

客户能力：

- 属性名称（可选）：textDocument.hover

- 属性类型：HoverClientCapabilities定义如下：

```
export interface HoverClientCapabilities {
	/**
	 * Whether hover supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * Client supports the follow content formats for the content
	 * property. The order describes the preferred format of the client.
	 */
	contentFormat?: MarkupKind[];
}
```

服务器功能：

- 属性名称（可选）：hoverProvider

- 物业类型：布尔值| HoverOptions，其中HoverOptions的定义如下：

```
export interface HoverOptions extends WorkDoneProgressOptions {
}
```

注册选项：HoverRegistrationOptions定义如下：

```
export interface HoverRegistrationOptions extends TextDocumentRegistrationOptions, HoverOptions {
}
```

请求：

- 方法：“ textDocument / hover”

- 参数：HoverParams定义如下：

```
export interface HoverParams extends TextDocumentPositionParams, WorkDoneProgressParams {
}
```

响应：

- 结果：悬停| null定义如下：

```
/**
 * The result of a hover request.
 */
export interface Hover {
	/**
	 * The hover's content
	 */
	contents: MarkedString | MarkedString[] | MarkupContent;

	/**
	 * An optional range is a range inside a text document
	 * that is used to visualize a hover, e.g. by changing the background color.
	 */
	range?: Range;
}
```

其中MarkedString的定义如下：

```
/**
 * MarkedString can be used to render human readable text. It is either a markdown string
 * or a code-block that provides a language and a code snippet. The language identifier
 * is semantically equal to the optional language identifier in fenced code blocks in GitHub
 * issues. See https://help.github.com/articles/creating-and-highlighting-code-blocks/#syntax-highlighting
 *
 * The pair of a language and a value is an equivalent to markdown:
 * ```${language}
 * ${value}
 * ```
 *
 * Note that markdown strings will be sanitized - that means html will be escaped.
* @deprecated use MarkupContent instead.
*/
type MarkedString = string | { language: string; value: string };
```

- 错误：代码和消息集，以防在悬停请求期间发生异常。

#### 签名帮助请求

签名帮助请求从客户端发送到服务器，以在给定的光标位置请求签名信息。

客户能力：

- 属性名称（可选）：textDocument.signatureHelp

- 属性类型：SignatureHelpClientCapabilities定义如下：

```
export interface SignatureHelpClientCapabilities {
	/**
	 * Whether signature help supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports the following `SignatureInformation`
	 * specific properties.
	 */
	signatureInformation?: {
		/**
		 * Client supports the follow content formats for the documentation
		 * property. The order describes the preferred format of the client.
		 */
		documentationFormat?: MarkupKind[];

		/**
		 * Client capabilities specific to parameter information.
		 */
		parameterInformation?: {
			/**
			 * The client supports processing label offsets instead of a
			 * simple label string.
			 *
			 * @since 3.14.0
			 */
			labelOffsetSupport?: boolean;
		};
	};

	/**
	 * The client supports to send additional context information for a
	 * `textDocument/signatureHelp` request. A client that opts into
	 * contextSupport will also support the `retriggerCharacters` on
	 * `SignatureHelpOptions`.
	 *
	 * @since 3.15.0
	 */
	contextSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：signatureHelpProvider

- 属性类型：SignatureHelpOptions定义如下：

```
export interface SignatureHelpOptions extends WorkDoneProgressOptions {
	/**
	 * The characters that trigger signature help
	 * automatically.
	 */
	triggerCharacters?: string[];

	/**
	 * List of characters that re-trigger signature help.
	 *
	 * These trigger characters are only active when signature help is already showing. All trigger characters
	 * are also counted as re-trigger characters.
	 *
	 * @since 3.15.0
	 */
	retriggerCharacters?: string[];
}
```

注册选项：SignatureHelpRegistrationOptions定义如下：

```
export interface SignatureHelpRegistrationOptions extends TextDocumentRegistrationOptions, SignatureHelpOptions {
}
```

请求：

- 方法：“ textDocument / signatureHelp”

- 参数：SignatureHelpParams定义如下：

```
export interface SignatureHelpParams extends TextDocumentPositionParams, WorkDoneProgressParams {
	/**
	 * The signature help context. This is only available if the client specifies
	 * to send this using the client capability  `textDocument.signatureHelp.contextSupport === true`
	 *
	 * @since 3.15.0
	 */
	context?: SignatureHelpContext;
}

/**
 * How a signature help was triggered.
 *
 * @since 3.15.0
 */
export namespace SignatureHelpTriggerKind {
	/**
	 * Signature help was invoked manually by the user or by a command.
	 */
	export const Invoked: 1 = 1;
	/**
	 * Signature help was triggered by a trigger character.
	 */
	export const TriggerCharacter: 2 = 2;
	/**
	 * Signature help was triggered by the cursor moving or by the document content changing.
	 */
	export const ContentChange: 3 = 3;
}
export type SignatureHelpTriggerKind = 1 | 2 | 3;

/**
 * Additional information about the context in which a signature help request was triggered.
 *
 * @since 3.15.0
 */
export interface SignatureHelpContext {
	/**
	 * Action that caused signature help to be triggered.
	 */
	triggerKind: SignatureHelpTriggerKind;

	/**
	 * Character that caused signature help to be triggered.
	 *
	 * This is undefined when `triggerKind !== SignatureHelpTriggerKind.TriggerCharacter`
	 */
	triggerCharacter?: string;

	/**
	 * `true` if signature help was already showing when it was triggered.
	 *
	 * Retriggers occur when the signature help is already active and can be caused by actions such as
	 * typing a trigger character, a cursor move, or document content changes.
	 */
	isRetrigger: boolean;

	/**
	 * The currently active `SignatureHelp`.
	 *
	 * The `activeSignatureHelp` has its `SignatureHelp.activeSignature` field updated based on
	 * the user navigating through available signatures.
	 */
	activeSignatureHelp?: SignatureHelp;
}
```

响应：

- 结果：SignatureHelp | null定义如下：

```
/**
 * Signature help represents the signature of something
 * callable. There can be multiple signature but only one
 * active and only one active parameter.
 */
export interface SignatureHelp {
	/**
	 * One or more signatures. If no signaures are availabe the signature help
	 * request should return `null`.
	 */
	signatures: SignatureInformation[];

	/**
	 * The active signature. If omitted or the value lies outside the
	 * range of `signatures` the value defaults to zero or is ignore if
	 * the `SignatureHelp` as no signatures.
	 *
	 * Whenever possible implementors should make an active decision about
	 * the active signature and shouldn't rely on a default value.
	 *
	 * In future version of the protocol this property might become
	 * mandatory to better express this.
	 */
	activeSignature?: number;

	/**
	 * The active parameter of the active signature. If omitted or the value
	 * lies outside the range of `signatures[activeSignature].parameters`
	 * defaults to 0 if the active signature has parameters. If
	 * the active signature has no parameters it is ignored.
	 * In future version of the protocol this property might become
	 * mandatory to better express the active parameter if the
	 * active signature does have any.
	 */
	activeParameter?: number;
}

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
export interface SignatureInformation {
	/**
	 * The label of this signature. Will be shown in
	 * the UI.
	 */
	label: string;

	/**
	 * The human-readable doc-comment of this signature. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string | MarkupContent;

	/**
	 * The parameters of this signature.
	 */
	parameters?: ParameterInformation[];
}

/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
export interface ParameterInformation {

	/**
	 * The label of this parameter information.
	 *
	 * Either a string or an inclusive start and exclusive end offsets within its containing
	 * signature label. (see SignatureInformation.label). The offsets are based on a UTF-16
	 * string representation as `Position` and `Range` does.
	 *
	 * *Note*: a label of type string should be a substring of its containing signature label.
	 * Its intended use case is to highlight the parameter label part in the `SignatureInformation.label`.
	 */
	label: string | [number, number];

	/**
	 * The human-readable doc-comment of this parameter. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string | MarkupContent;
}
```

- 错误：代码和消息集，以防签名帮助请求期间发生异常。

#### 转到声明请求

转到声明请求从客户端发送到服务器，以解析符号在给定文本文档位置的声明位置。

结果类型LocationLink []在3.14.0版本中引入，并取决于相应的客户端功能textDocument.declaration.linkSupport。

客户能力：

- 属性名称（可选）：textDocument.declaration

- 属性类型：DeclarationClientCapabilities定义如下：

```
export interface DeclarationClientCapabilities {
	/**
	 * Whether declaration supports dynamic registration. If this is set to `true`
	 * the client supports the new `DeclarationRegistrationOptions` return value
	 * for the corresponding server capability as well.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports additional metadata in the form of declaration links.
	 */
	linkSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：clarificationProvider

- 类型：布尔值| 声明选项| DeclarationRegistrationOptions，其中clarificationOptions的定义如下：

```
export interface DeclarationOptions extends WorkDoneProgressOptions {
}
```

注册选项：DeclarationRegistrationOptions定义如下：

```
export interface DeclarationRegistrationOptions extends DeclarationOptions, TextDocumentRegistrationOptions, StaticRegistrationOptions  {
}
```

请求：

- 方法：“ textDocument / declaration”

- 参数：clarificationParams定义如下：

```
export interface DeclarationParams extends TextDocumentPositionParams, WorkDoneProgressParams, PartialResultParams {
}
```

响应：

- 结果：位置| 位置[] | LocationLink [] |空

- 部分结果：位置[] | LocationLink []

- 错误：在声明请求期间发生异常的情况下设置的代码和消息。

#### 转到定义请求

转到定义请求从客户端发送到服务器，以解析符号在给定文本文档位置的定义位置。

结果类型LocationLink []在3.14.0版本中引入，并取决于相应的客户端功能textDocument.definition.linkSupport。

客户能力：

- 属性名称（可选）：textDocument.definition

- 属性类型：DefinitionClientCapabilities定义如下：

```
export interface DefinitionClientCapabilities {
	/**
	 * Whether definition supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports additional metadata in the form of definition links.
	 *
	 * @since 3.14.0
	 */
	linkSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：definitionProvider

- 类型：布尔值| DefinitionOptions，其中DefinitionOptions定义如下：

```
export interface DefinitionOptions extends WorkDoneProgressOptions {
}
```

注册选项：DefinitionRegistrationOptions定义如下：

```
export interface DefinitionRegistrationOptions extends TextDocumentRegistrationOptions, DefinitionOptions {
}
```

请求：

- 方法：“ textDocument / definition”

- 参数：Definition参数定义如下：

```
export interface DefinitionParams extends TextDocumentPositionParams, WorkDoneProgressParams, PartialResultParams {
}
```

响应：

 -结果：位置| 位置[] | LocationLink [] | 空值

- 部分结果：位置[] | LocationLink []

- 错误：在定义请求期间发生异常的情况下设置的代码和消息。

#### 转到类型定义请求

类型定义请求从客户端发送到服务器，以解析符号在给定文本文档位置的类型定义位置。

结果类型LocationLink []在3.14.0版本中引入，并取决于相应的客户端功能textDocument.typeDefinition.linkSupport。

客户能力：

- 属性名称（可选）：textDocument.typeDefinition

- 属性类型：TypeDefinitionClientCapabilities定义如下：

```
export interface TypeDefinitionClientCapabilities {
	/**
	 * Whether implementation supports dynamic registration. If this is set to `true`
	 * the client supports the new `TypeDefinitionRegistrationOptions` return value
	 * for the corresponding server capability as well.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports additional metadata in the form of definition links.
	 *
	 * @since 3.14.0
	 */
	linkSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：typeDefinitionProvider

- 类型：布尔值| TypeDefinitionOptions | TypeDefinitionRegistrationOptions，其中TypeDefinitionOptions定义如下：

```
export interface TypeDefinitionOptions extends WorkDoneProgressOptions {
}
```

请求：

- 方法：“ textDocument / typeDefinition”

- 参数：TypeDefinitionParams定义如下：

```
export interface TypeDefinitionParams extends TextDocumentPositionParams, WorkDoneProgressParams, PartialResultParams {
}
```

响应：

- 结果：位置| 位置[] | LocationLink [] | 空值

- 部分结果：位置[] | LocationLink []

- 错误：在定义请求期间发生异常的情况下设置的代码和消息。

#### 转到实施请求

转到实现请求从客户端发送到服务器，以解析符号在给定文本文档位置的实现位置。

结果类型LocationLink []在3.14.0版本中引入，并取决于相应的客户端功能textDocument.implementation.linkSupport。

客户能力：

- 属性名称（可选）：textDocument.implementation

- 属性类型：ImplementationClientCapabilities定义如下：

```
export interface ImplementationClientCapabilities {
	/**
	 * Whether implementation supports dynamic registration. If this is set to `true`
	 * the client supports the new `ImplementationRegistrationOptions` return value
	 * for the corresponding server capability as well.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports additional metadata in the form of definition links.
	 *
	 * @since 3.14.0
	 */
	linkSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：ImplementationProvider

- 类型：布尔值| 实施选项| ImplementationRegistrationOptions，其中ImplementationOptions定义如下：

```
export interface ImplementationOptions extends WorkDoneProgressOptions {
}
```

注册选项：ImplementationRegistrationOptions定义如下：

```
export interface ImplementationRegistrationOptions extends TextDocumentRegistrationOptions, ImplementationOptions, StaticRegistrationOptions {
}
```

请求：

- 方法：“ textDocument /实现”

- 参数：ImplementationParams定义如下：

```
export interface ImplementationParams extends TextDocumentPositionParams, WorkDoneProgressParams, PartialResultParams {
}
```

响应：

- 结果：位置| 位置[] | LocationLink [] | 空值

- 部分结果：位置[] | LocationLink []

- 错误：在定义请求期间发生异常的情况下设置的代码和消息。

#### 查找引用请求

引用请求从客户端发送到服务器，以解析由给定文本文档位置表示的符号的项目范围引用。

客户能力：

- 属性名称（可选）：textDocument.references

- 属性类型：ReferenceClientCapabilities定义如下：

```
export interface ReferenceClientCapabilities {
	/**
	 * Whether references supports dynamic registration.
	 */
	dynamicRegistration?: boolean;
}
```

服务器功能：

- 属性名称（可选）：referencesProvider

- 类型：布尔值| ReferenceOptions，其中ReferenceOptions的定义如下：

```
export interface ReferenceOptions extends WorkDoneProgressOptions {
}
```

注册选项：ReferenceRegistrationOptions定义如下：

```
export interface ReferenceRegistrationOptions extends TextDocumentRegistrationOptions, ReferenceOptions {
}
```

请求：

- 方法：“ textDocument /引用”

- 参数：ReferenceParams定义如下：

```
export interface ReferenceParams extends TextDocumentPositionParams, WorkDoneProgressParams, PartialResultParams {
	context: ReferenceContext
}

export interface ReferenceContext {
	/**
	 * Include the declaration of the current symbol.
	 */
	includeDeclaration: boolean;
}
```



响应：

- 结果：Location [] | 空值

- 部分结果：位置[]

- 错误：在参考请求期间发生异常的情况下设置的代码和消息。

#### 文档重点请求

文档突出显示请求从客户端发送到服务器，以解析给定文本文档位置的文档突出显示。 对于编程语言，这通常会突出显示对该文件范围内的符号的所有引用。 但是，我们将“ textDocument / documentHighlight”和“ textDocument / references”的请求分开保存，因为第一个请求更加模糊。 符号匹配通常具有DocumentHighlightKind的Read或Write属性，而模糊或文本匹配则使用Text作为种类。

客户能力：

- 属性名称（可选）：textDocument.documentHighlight

- 属性类型：DocumentHighlightClientCapabilities定义如下：

```
export interface DocumentHighlightClientCapabilities {
	/**
	 * Whether document highlight supports dynamic registration.
	 */
	dynamicRegistration?: boolean;
}
```

服务器功能：

属性名称（可选）：documentHighlightProvider
物业类型：布尔值| DocumentHighlightOptions，其中DocumentHighlightOptions的定义如下：

```
export interface DocumentHighlightOptions extends WorkDoneProgressOptions {
}
```

注册选项：DocumentHighlightRegistrationOptions定义如下：

```
export interface DocumentHighlightRegistrationOptions extends TextDocumentRegistrationOptions, DocumentHighlightOptions {
}
```

请求：

- 方法：“ textDocument / documentHighlight”

- 参数：DocumentHighlightParams定义如下：

```
export interface DocumentHighlightParams extends TextDocumentPositionParams, WorkDoneProgressParams, PartialResultParams {
}
```

响应：

- 结果：DocumentHighlight [] | null定义如下：

```
/**
 * A document highlight is a range inside a text document which deserves
 * special attention. Usually a document highlight is visualized by changing
 * the background color of its range.
 *
 */
export interface DocumentHighlight {
	/**
	 * The range this highlight applies to.
	 */
	range: Range;

	/**
	 * The highlight kind, default is DocumentHighlightKind.Text.
	 */
	kind?: number;
}

/**
 * A document highlight kind.
 */
export namespace DocumentHighlightKind {
	/**
	 * A textual occurrence.
	 */
	export const Text = 1;

	/**
	 * Read-access of a symbol, like reading a variable.
	 */
	export const Read = 2;

	/**
	 * Write-access of a symbol, like writing to a variable.
	 */
	export const Write = 3;
}
```

部分结果：DocumentHighlight []
错误：代码和消息集，以防文档突出显示请求期间发生异常。

#### 文档符号请求

文档符号请求从客户端发送到服务器。 返回的结果是

- SymbolInformation []是在给定文本文档中找到的所有符号的平面列表。 然后，符号的位置范围和符号的容器名称均不得用于推断层次结构。

- DocumentSymbol []是在给定文本文档中找到的符号的层次结构。

客户端能力：

- 属性名称（可选）：textDocument.documentSymbol

- 属性类型：DocumentSymbolClientCapabilities定义如下：

```
export interface DocumentSymbolClientCapabilities {
	/**
	 * Whether document symbol supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * Specific capabilities for the `SymbolKind` in the `textDocument/documentSymbol` request.
	 */
	symbolKind?: {
		/**
		 * The symbol kind values the client supports. When this
		 * property exists the client also guarantees that it will
		 * handle values outside its set gracefully and falls back
		 * to a default value when unknown.
		 *
		 * If this property is not present the client only supports
		 * the symbol kinds from `File` to `Array` as defined in
		 * the initial version of the protocol.
		 */
		valueSet?: SymbolKind[];
	}

	/**
	 * The client supports hierarchical document symbols.
	 */
	hierarchicalDocumentSymbolSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：documentSymbolProvider

- 类型：布尔值| 其中DocumentSymbolOptions定义如下的DocumentSymbolOptions：

```
export interface DocumentSymbolOptions extends WorkDoneProgressOptions {
}
```

注册选项：DocumentSymbolRegistrationOptions定义如下：

```
export interface DocumentSymbolRegistrationOptions extends TextDocumentRegistrationOptions, DocumentSymbolOptions {
}
```

请求：

- 方法：“ textDocument / documentSymbol”

- 参数：DocumentSymbolParams定义如下

```
export interface DocumentSymbolParams extends WorkDoneProgressParams, PartialResultParams {
	/**
	 * The text document.
	 */
	textDocument: TextDocumentIdentifier;
}
```

响应：

- 结果：DocumentSymbol [] | SymbolInformation [] | null定义如下：

```
/**
 * A symbol kind.
 */
export namespace SymbolKind {
	export const File = 1;
	export const Module = 2;
	export const Namespace = 3;
	export const Package = 4;
	export const Class = 5;
	export const Method = 6;
	export const Property = 7;
	export const Field = 8;
	export const Constructor = 9;
	export const Enum = 10;
	export const Interface = 11;
	export const Function = 12;
	export const Variable = 13;
	export const Constant = 14;
	export const String = 15;
	export const Number = 16;
	export const Boolean = 17;
	export const Array = 18;
	export const Object = 19;
	export const Key = 20;
	export const Null = 21;
	export const EnumMember = 22;
	export const Struct = 23;
	export const Event = 24;
	export const Operator = 25;
	export const TypeParameter = 26;
}

/**
 * Represents programming constructs like variables, classes, interfaces etc. that appear in a document. Document symbols can be
 * hierarchical and they have two ranges: one that encloses its definition and one that points to its most interesting range,
 * e.g. the range of an identifier.
 */
export interface DocumentSymbol {

	/**
	 * The name of this symbol. Will be displayed in the user interface and therefore must not be
	 * an empty string or a string only consisting of white spaces.
	 */
	name: string;

	/**
	 * More detail for this symbol, e.g the signature of a function.
	 */
	detail?: string;

	/**
	 * The kind of this symbol.
	 */
	kind: SymbolKind;

	/**
	 * Indicates if this symbol is deprecated.
	 */
	deprecated?: boolean;

	/**
	 * The range enclosing this symbol not including leading/trailing whitespace but everything else
	 * like comments. This information is typically used to determine if the clients cursor is
	 * inside the symbol to reveal in the symbol in the UI.
	 */
	range: Range;

	/**
	 * The range that should be selected and revealed when this symbol is being picked, e.g the name of a function.
	 * Must be contained by the `range`.
	 */
	selectionRange: Range;

	/**
	 * Children of this symbol, e.g. properties of a class.
	 */
	children?: DocumentSymbol[];
}

/**
 * Represents information about programming constructs like variables, classes,
 * interfaces etc.
 */
export interface SymbolInformation {
	/**
	 * The name of this symbol.
	 */
	name: string;

	/**
	 * The kind of this symbol.
	 */
	kind: SymbolKind;

	/**
	 * Indicates if this symbol is deprecated.
	 */
	deprecated?: boolean;

	/**
	 * The location of this symbol. The location's range is used by a tool
	 * to reveal the location in the editor. If the symbol is selected in the
	 * tool the range's start information is used to position the cursor. So
	 * the range usually spans more then the actual symbol's name and does
	 * normally include things like visibility modifiers.
	 *
	 * The range doesn't have to denote a node range in the sense of a abstract
	 * syntax tree. It can therefore not be used to re-construct a hierarchy of
	 * the symbols.
	 */
	location: Location;

	/**
	 * The name of the symbol containing this symbol. This information is for
	 * user interface purposes (e.g. to render a qualifier in the user interface
	 * if necessary). It can't be used to re-infer a hierarchy for the document
	 * symbols.
	 */
	containerName?: string;
}
```

- 错误：代码和消息集，以防文档符号请求期间发生异常。

#### 代码操作请求

代码操作请求从客户端发送到服务器，以计算给定文本文档和范围的命令。这些命令通常是代码修复程序，用于修复问题或美化/重构代码。 textDocument / codeAction请求的结果是通常在用户界面中显示的Command文字的数组。为了确保服务器在许多客户端中有用，在代码操作中指定的命令应由服务器而不是客户端处理（请参见workspace / executeCommand和ServerCapabilities.executeCommandProvider）。如果客户端支持通过代码操作提供编辑，则应使用该模式。

选择命令后，应再次联系服务器（通过workspace / executeCommand）请求以执行命令。

从3.8.0版开始：支持CodeAction文字以启用以下方案：

从代码操作请求中直接返回工作区编辑的功能。这避免了另一个服务器往返执行实际的代码操作。但是，服务器提供者应注意，如果代码操作的计算成本很高或编辑量很大，那么如果结果只是命令而仅在需要时才计算实际编辑量，则可能仍会有所益处。
使用一种对动作进行分组的能力。允许客户忽略该信息。但是，它允许他们更好地将代码操作分组到例如相应的菜单中（例如，将所有重构代码操作合并到重构菜单中）。
客户需要通过相应的客户端功能codeAction.codeActionLiteralSupport宣布对代码操作文字和代码操作种类的支持。

客户能力：

- 属性名称（可选）：textDocument.codeAction

- 属性类型：CodeActionClientCapabilities定义如下：

```
export interface CodeActionClientCapabilities {
	/**
	 * Whether code action supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * The client supports code action literals as a valid
	 * response of the `textDocument/codeAction` request.
	 *
	 * @since 3.8.0
	 */
	codeActionLiteralSupport?: {
		/**
		 * The code action kind is supported with the following value
		 * set.
		 */
		codeActionKind: {

			/**
			 * The code action kind values the client supports. When this
			 * property exists the client also guarantees that it will
			 * handle values outside its set gracefully and falls back
			 * to a default value when unknown.
			 */
			valueSet: CodeActionKind[];
		};
	};

	/**
	 * Whether code action supports the `isPreferred` property.
	 * @since 3.15.0
	 */
	isPreferredSupport?: boolean;
}
```

服务器功能：

- 属性名称（可选）：codeActionProvider

- 类型：布尔值| CodeActionOptions，其中CodeActionOptions的定义如下：

```
export interface CodeActionOptions extends WorkDoneProgressOptions {
	/**
	 * CodeActionKinds that this server may return.
	 *
	 * The list of kinds may be generic, such as `CodeActionKind.Refactor`, or the server
	 * may list out every specific kind they provide.
	 */
	codeActionKinds?: CodeActionKind[];
}
```

注册选项：CodeActionRegistrationOptions定义如下：

```
export interface CodeActionRegistrationOptions extends TextDocumentRegistrationOptions, CodeActionOptions {
}
```

请求：

- 方法：“ textDocument / codeAction”

- 参数：CodeActionParams定义如下：

```
/**
 * Params for the CodeActionRequest
 */
export interface CodeActionParams extends WorkDoneProgressParams, PartialResultParams {
	/**
	 * The document in which the command was invoked.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The range for which the command was invoked.
	 */
	range: Range;

	/**
	 * Context carrying additional information.
	 */
	context: CodeActionContext;
}

/**
 * The kind of a code action.
 *
 * Kinds are a hierarchical list of identifiers separated by `.`, e.g. `"refactor.extract.function"`.
 *
 * The set of kinds is open and client needs to announce the kinds it supports to the server during
 * initialization.
 */
export type CodeActionKind = string;

/**
 * A set of predefined code action kinds.
 */
export namespace CodeActionKind {

	/**
	 * Empty kind.
	 */
	export const Empty: CodeActionKind = '';

	/**
	 * Base kind for quickfix actions: 'quickfix'.
	 */
	export const QuickFix: CodeActionKind = 'quickfix';

	/**
	 * Base kind for refactoring actions: 'refactor'.
	 */
	export const Refactor: CodeActionKind = 'refactor';

	/**
	 * Base kind for refactoring extraction actions: 'refactor.extract'.
	 *
	 * Example extract actions:
	 *
	 * - Extract method
	 * - Extract function
	 * - Extract variable
	 * - Extract interface from class
	 * - ...
	 */
	export const RefactorExtract: CodeActionKind = 'refactor.extract';

	/**
	 * Base kind for refactoring inline actions: 'refactor.inline'.
	 *
	 * Example inline actions:
	 *
	 * - Inline function
	 * - Inline variable
	 * - Inline constant
	 * - ...
	 */
	export const RefactorInline: CodeActionKind = 'refactor.inline';

	/**
	 * Base kind for refactoring rewrite actions: 'refactor.rewrite'.
	 *
	 * Example rewrite actions:
	 *
	 * - Convert JavaScript function to class
	 * - Add or remove parameter
	 * - Encapsulate field
	 * - Make method static
	 * - Move method to base class
	 * - ...
	 */
	export const RefactorRewrite: CodeActionKind = 'refactor.rewrite';

	/**
	 * Base kind for source actions: `source`.
	 *
	 * Source code actions apply to the entire file.
	 */
	export const Source: CodeActionKind = 'source';

	/**
	 * Base kind for an organize imports source action: `source.organizeImports`.
	 */
	export const SourceOrganizeImports: CodeActionKind = 'source.organizeImports';
}

/**
 * Contains additional diagnostic information about the context in which
 * a code action is run.
 */
export interface CodeActionContext {
	/**
	 * An array of diagnostics known on the client side overlapping the range provided to the
	 * `textDocument/codeAction` request. They are provided so that the server knows which
	 * errors are currently presented to the user for the given range. There is no guarantee
	 * that these accurately reflect the error state of the resource. The primary parameter
	 * to compute code actions is the provided range.
	 */
	diagnostics: Diagnostic[];

	/**
	 * Requested kind of actions to return.
	 *
	 * Actions not of this kind are filtered out by the client before being shown. So servers
	 * can omit computing them.
	 */
	only?: CodeActionKind[];
}
```

响应：

- 结果：（Command | CodeAction）[] | null，其中CodeAction定义如下：

```
/**
 * A code action represents a change that can be performed in code, e.g. to fix a problem or
 * to refactor code.
 *
 * A CodeAction must set either `edit` and/or a `command`. If both are supplied, the `edit` is applied first, then the `command` is executed.
 */
export interface CodeAction {

	/**
	 * A short, human-readable, title for this code action.
	 */
	title: string;

	/**
	 * The kind of the code action.
	 *
	 * Used to filter code actions.
	 */
	kind?: CodeActionKind;

	/**
	 * The diagnostics that this code action resolves.
	 */
	diagnostics?: Diagnostic[];

	/**
	 * Marks this as a preferred action. Preferred actions are used by the `auto fix` command and can be targeted
	 * by keybindings.
	 *
	 * A quick fix should be marked preferred if it properly addresses the underlying error.
	 * A refactoring should be marked preferred if it is the most reasonable choice of actions to take.
	 *
	 * @since 3.15.0
	 */
	isPreferred?: boolean;

	/**
	 * The workspace edit this code action performs.
	 */
	edit?: WorkspaceEdit;

	/**
	 * A command this code action executes. If a code action
	 * provides an edit and a command, first the edit is
	 * executed and then the command.
	 */
	command?: Command;
}
```

- 部分结果：（命令| CodeAction）[]

- 错误：代码和消息集，以防在代码操作请求期间发生异常。

#### 代码镜头请求

代码镜头请求从客户端发送到服务器，以计算给定文本文档的代码镜头。

客户能力：

- 属性名称（可选）：textDocument.codeLens

- 属性类型：CodeLensClientCapabilities定义如下：

```
export interface CodeLensClientCapabilities {
	/**
	 * Whether code lens supports dynamic registration.
	 */
	dynamicRegistration?: boolean;
}
```

服务器功能：

- 属性名称（可选）：codeLensProvider

- 属性类型：CodeLensOptions定义如下：

```
export interface CodeLensOptions extends WorkDoneProgressOptions {
	/**
	 * Code lens has a resolve provider as well.
	 */
	resolveProvider?: boolean;
}
```

注册选项：CodeLensRegistrationOptions定义如下：

```
export interface CodeLensRegistrationOptions extends TextDocumentRegistrationOptions, CodeLensOptions {
}
```

请求：

- 方法：“ textDocument / codeLens”

- 参数：CodeLensParams定义如下：

```
interface CodeLensParams extends WorkDoneProgressParams, PartialResultParams {
	/**
	 * The document to request code lens for.
	 */
	textDocument: TextDocumentIdentifier;
}
```

响应：

- 结果：CodeLens [] | null定义如下：

```
**
 * A code lens represents a command that should be shown along with
 * source text, like the number of references, a way to run tests, etc.
 *
 * A code lens is _unresolved_ when no command is associated to it. For performance
 * reasons the creation of a code lens and resolving should be done in two stages.
 */
interface CodeLens {
	/**
	 * The range in which this code lens is valid. Should only span a single line.
	 */
	range: Range;

	/**
	 * The command this code lens represents.
	 */
	command?: Command;

	/**
	 * A data entry field that is preserved on a code lens item between
	 * a code lens and a code lens resolve request.
	 */
	data?: any
}
```

部分结果：CodeLens []
错误：设置代码和消息，以防在代码镜头请求期间发生异常。

#### 代码镜头解析请求

编码镜头解析请求从客户端发送到服务器，以解析给定编码镜头项目的命令。

请求：

- 方法：“ codeLens / resolve”

- 参数：CodeLens

响应：

- 结果：CodeLens

- 错误：在代码镜头解析请求期间发生异常的情况下设置了代码和消息。

#### 文档链接请求

文档链接请求从客户端发送到服务器，以请求链接在文档中的位置。

客户能力：

- 属性名称（可选）：textDocument.documentLink

- 属性类型：DocumentLinkClientCapabilities定义如下：

```
export interface DocumentLinkClientCapabilities {
	/**
	 * Whether document link supports dynamic registration.
	 */
	dynamicRegistration?: boolean;

	/**
	 * Whether the client supports the `tooltip` property on `DocumentLink`.
	 *
	 * @since 3.15.0
	 */
	tooltipSupport?: boolean;
}
```

服务器功能：

属性名称（可选）：documentLinkProvider
属性类型：DocumentLinkOptions定义如下：

```
export interface DocumentLinkOptions extends WorkDoneProgressOptions {
	/**
	 * Document links have a resolve provider as well.
	 */
	resolveProvider?: boolean;
}
```

注册选项：DocumentLinkRegistrationOptions定义如下：

```
export interface DocumentLinkRegistrationOptions extends TextDocumentRegistrationOptions, DocumentLinkOptions {
}
```

请求：

- 方法：“ textDocument / documentLink”

- 参数：DocumentLinkParams定义如下：

```
interface DocumentLinkParams extends WorkDoneProgressParams, PartialResultParams {
	/**
	 * The document to provide document links for.
	 */
	textDocument: TextDocumentIdentifier;
}
```

响应：

- 结果：DocumentLink [] | 空值。

```
/**
 * A document link is a range in a text document that links to an internal or external resource, like another
 * text document or a web site.
 */
interface DocumentLink {
	/**
	 * The range this link applies to.
	 */
	range: Range;

	/**
	 * The uri this link points to. If missing a resolve request is sent later.
	 */
	target?: DocumentUri;

	/**
	 * The tooltip text when you hover over this link.
	 *
	 * If a tooltip is provided, is will be displayed in a string that includes instructions on how to
	 * trigger the link, such as `{0} (ctrl + click)`. The specific instructions vary depending on OS,
	 * user settings, and localization.
	 *
	 * @since 3.15.0
	 */
	tooltip?: string;

	/**
	 * A data entry field that is preserved on a document link between a
	 * DocumentLinkRequest and a DocumentLinkResolveRequest.
	 */
	data?: any;
}
```

部分结果：DocumentLink []
错误：代码和消息集，以防文档链接请求期间发生异常。

#### 文档链接解析请求

文档链接解析请求从客户端发送到服务器，以解析给定文档链接的目标。

请求：

- 方法：“ documentLink / resolve”

- 参数：DocumentLink

响应：

- 结果：DocumentLink

- 错误：在文档链接解析请求期间发生异常的情况下设置的代码和消息。

#### 文档颜色请求

从3.6.0版开始

文档颜色请求从客户端发送到服务器，以列出在给定文本文档中找到的所有颜色参考。与范围一起，返回RGB的颜色值。

客户端可以使用结果在编辑器中修饰颜色参考。例如：

- 颜色框显示参考旁边的实际颜色

- 编辑颜色参考时显示颜色选择器

客户能力：

- 属性名称（可选）：textDocument.colorProvider

- 属性类型：DocumentColorClientCapabilities定义如下：

```
export interface DocumentColorClientCapabilities {
	/**
	 * Whether document color supports dynamic registration.
	 */
	dynamicRegistration?: boolean;
}
```

服务器功能：

- 属性名称（可选）：colorProvider

- 物业类型：布尔值| DocumentColorOptions | DocumentColorRegistrationOptions，其中DocumentColorOptions定义如下：

```
export interface DocumentColorOptions extends WorkDoneProgressOptions {
}
```

请求：

- 方法：“ textDocument / documentColor”

- 参数：DocumentColorParams定义如下

```
interface DocumentColorParams extends WorkDoneProgressParams, PartialResultParams {
	/**
	 * The text document.
	 */
	textDocument: TextDocumentIdentifier;
}
```

响应：

- 结果：ColorInformation []定义如下：

```
interface ColorInformation {
	/**
	 * The range in the document where this color appears.
	 */
	range: Range;

	/**
	 * The actual color value for this color range.
	 */
	color: Color;
}

/**
 * Represents a color in RGBA space.
 */
interface Color {

	/**
	 * The red component of this color in the range [0-1].
	 */
	readonly red: number;

	/**
	 * The green component of this color in the range [0-1].
	 */
	readonly green: number;

	/**
	 * The blue component of this color in the range [0-1].
	 */
	readonly blue: number;

	/**
	 * The alpha component of this color in the range [0-1].
	 */
	readonly alpha: number;
}
```

- 部分结果：ColorInformation []

- 错误：设置了代码和消息，以防在“ textDocument / documentColor”请求期间发生异常