import mongoose from 'mongoose'
import mongooseTimestamp from 'mongoose-timestamp'
import { Verbose } from '../services.js'

const verbose = Verbose('sd:models/map'); verbose('')

const { ObjectId, Mixed } = mongoose.Schema.Types

// The Map defines a workflow for agent orchestration and coordination. It defines what message a recipient (agent or human) receives. The messages that will be send to a recipient are text and file attachments from source notes. The response from recipient gets saved as text and file attachments in the destination edges. The execution (sending messages to recipients) is according to the order of the edges in the edges array. The execution starts from the first edge, goes through all the edges, edge-by-edge, then stops when there is not more edges left in the array.

// ---------- Base parts ----------

const PositionSchema = new mongoose.Schema({
  x: Number,  // The horizontal coordinate of the node’s position on the ReactFlow canvas
  y: Number,  // The vertical coordinate of the node’s position on the ReactFlow canvas
}, { _id: false, strict: false })

const StyleSchema = new mongoose.Schema({
  width: Number,   // The explicit width applied to the node or edge element in pixels
  height: Number,  // The explicit height applied to the node or edge element in pixels
  color: String,   // The primary or text color used for labels, icons, or stroke accents
  backgroundColor: String,  // The background fill color of the node or edge element
}, { _id: false, strict: false })


const MeasuredSchema = new mongoose.Schema({
  width: Number,   // The computed width of the node after it has been rendered and measured by ReactFlow
  height: Number,  // The computed height of the node after it has been rendered and measured by ReactFlow
}, { _id: false, strict: false })


// ReactFlow's viewport
const ViewportSchema = new mongoose.Schema({
  x: Number,     // The horizontal offset of the ReactFlow canvas, representing the current scroll position along the X-axis
  y: Number,     // The vertical offset of the ReactFlow canvas, representing the current scroll position along the Y-axis
  zoom: Number,  // The current zoom level of the ReactFlow viewport, where 1 represents 100% (default scale)
}, { _id: false, strict: false })

// ---------- Node Data Schemas ----------

const NoteNodeDataSchema = new mongoose.Schema({
  uname: String,            // Unique node name
  renaming: Boolean,        // True when user renaming the note to show name input
  text: String,             // Note text. The text can be smart text when it contains [[node_uname]], then the subsctring [[node_uname]] is substituted with the text of the node_uname. It is possible to disable the smart text substitution by commenting it as [/*[node_uname]*/]. The subsctitution is nested if the node_uname also contains the [[other_node_uname]]. Multiple [[uname1]], [[uname2]], etc. inside one text get all substituted with the texts of those nodes.
  attachments: [String],    // List of urls of attached files
  stash: String,            // Note stash for text (used for diff text and stash)
  stashAttachments: [String],  // List of urls of attached files in stash
  waitRecipient: String,    // Xmpp address of the recipient to which we sent a message and waiting for reply
  kind: { type: String, enum: ['markdown', 'code', 'raw', null] }, // Kind the node content, one of values: 'markdown', 'code', 'raw' or `undefined` (plain)
  editing: Boolean,         // Editing/viewing mode switch
  diffing: Boolean,         // If the note is in the diff mode (diff of text and stash with their attachemnts)
  slide: Boolean,           // If the note is slide in the deck
  slideIndex: Number,       // Number of the slide in the deck
  color: String,            // Text color
  backgroundColor: String,  // Background color
  lang: String,             // Programming language for notes with code kind
}, { _id: false, strict: false })

const GroupNodeDataSchema = new mongoose.Schema({
  uname: String,      // Unique group name
  renaming: Boolean,  // True when user renaming the group to show name input
  color: String,      // Text color
  backgroundColor: String, // Background color
  and: { type: Boolean, default: true }, // AND (all expressions safisfied) if true otherwise OR (any expression satisfied) loop exit condition
}, { _id: false, strict: false })

// GroupNode has child node ids.
// The GroupNode organizes the execution loops considers the following types of edges:
// * init edges: init loop variables but do not participate in a loop.
// * inner edges: repeats continuously unil one of the exit edges conditinos get satisfied starting with the first edge in array.
// * exit edges: allow exit loop if one of the edge's conditions get satisfied.
// * loop edges:  loop through all inner and exit edges.

// ---------- Edge Schema ----------

const MarkerEndSchema = new mongoose.Schema({
  type: String,    // Type of marker displayed at the edge end; usually MarkerType.ArrowClosed for a closed arrowhead
  width: Number,   // Width of the marker in pixels, typically 20
  height: Number,  // Height of the marker in pixels, typically 20
  color: String,   // Color of the marker, usually matching the edge stroke color
}, { _id: false, strict: false })

const RequestEdgeDataSchema = new mongoose.Schema({
  recipient: String,   // The agent name, xmpp address of the agent, e.g. agentname@username.x.hyag.ru
  condition: String,   // Regular expresson, the edge gets executed (message send to recipient if the condition is satisfied when applied to the source edge before sending the message to the recipient
  stroke: String,      // Stroke line color
  satisfied: Boolean,  // If condition is satisfied by applying the condition regex to the source node smart text
  safe: Boolean,       // If the condition regex is safe
  expecting: Boolean,  // Execution is expected, colors edge label yellow
  cursor: Boolean,     // If this edge is being executed (message send to a recipient and waiting for the answer), colors edge label to olive
  reordering: Boolean, // If in reordering mode, colors edge label to blue
  sequence: Number,    // Order number of the edge
}, { _id: false, strict: false })

const RequestEdgeSchema = new mongoose.Schema({
  id: { type: String, required: true },  // Unique identifier for the edge, typically formatted as `${sourceNodeId}->${targetNodeId}`
  type: { type: String, enum: ['RequestEdge'], required: true },  // Specifies the edge type; in this schema, it is always 'RequestEdge'
  source: String,        // The ID of the node where the edge originates
  target: String,        // The ID of the node where the edge terminates
  sourceHandle: String,  // The ID of the handle on the source node from which the edge originates
  targetHandle: String,  // The ID of the handle on the target node where the edge connects

  animated: Boolean,  // Determines if the edge displays an animation (e.g., moving dashed line), often true for active edges
  selected: Boolean,  // Indicates whether the edge is currently selected in the ReactFlow editor
  sourceX: Number,    // The horizontal coordinate of the edge's starting point on the source node
  sourceY: Number,    // The vertical coordinate of the edge's starting point on the source node
  targetX: Number,    // The horizontal coordinate of the edge's ending point on the target node
  targetY: Number,    // The vertical coordinate of the edge's ending point on the target node

  data: RequestEdgeDataSchema,  // Contains custom data for the edge, such as labels, metadata, or additional properties
  style: StyleSchema,           // Defines the visual appearance of the edge, including stroke color, width, and line style
  markerEnd: MarkerEndSchema,   // Specifies the arrowhead or marker displayed at the edge's target end
}, { _id: false, strict: false })

// ---------- Base Node Schema ----------

const BaseNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },    // Unique identifier for the node within the ReactFlow graph
  type: { type: String, required: true },  // Specifies the node type, e.g., 'NoteNode' for a note or 'group' for a node group
  position: { type: PositionSchema, required: true },  // Defines the x and y coordinates of the node's top-left corner in the canvas
  style: StyleSchema,  // Visual styling for the node, including colors, borders, and other CSS-like properties
}, { discriminatorKey: 'type', _id: false, strict: false })


// ---------- Flow Schema (before discriminators) ----------

const FlowSchema = new mongoose.Schema({
  nodes: [BaseNodeSchema],     // Array of nodes representing elements in the ReactFlow diagram (e.g., components, groups, or data blocks)
  edges: [RequestEdgeSchema],  // Array of edges defining the connections and data flow between nodes
  viewport: ViewportSchema,    // Defines the current visible area of the ReactFlow canvas, including position (x, y) and zoom level
}, { _id: false, strict: false })

// ---------- Apply embedded discriminators ----------

// Define the subdocument array path
const NodesArray = FlowSchema.path('nodes')

// Attach discriminators to nodes array
NodesArray.discriminator('NoteNode', new mongoose.Schema({
  data: NoteNodeDataSchema,  // Custom data specific to the NoteNode, including text content, attachments, or metadata
  measured: MeasuredSchema,  // Automatically added by ReactFlow to store the node’s dimensions and position after layout calculation
  parentId: String,          // The ID of the parent GroupNode if this node is nested inside a group
  width: Number,             // The rendered width of the node on the canvas
  height: Number,            // The rendered height of the node on the canvas
  dragging: Boolean,         // Indicates whether the node is currently being dragged by the user
  resizing: Boolean,         // Indicates whether the node is currently being resized by the user
  extent: String,            // Defines the boundaries within which the node can be moved (e.g., 'parent' or 'viewport')
  color: String,             // The text or accent color used for the node's content or label
  backgroundColor: String,   // The fill color of the node's background
  selected: Boolean,         // Indicates whether the node is currently selected in the ReactFlow editor
}, { _id: false }))

NodesArray.discriminator('group', new mongoose.Schema({
  data: GroupNodeDataSchema,
}, { _id: false, strict: false }))

// ---------- Main Map Schema ----------

const MapSchema = new mongoose.Schema({
  userId: { type: ObjectId, required: true, ref: 'User' },
  title: String,
  flow: { type: FlowSchema, default: {} },

  templateMapId: { type: ObjectId, ref: 'Map' },
  executing: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
}, { strict: false })  // <-- prevents Mongoose from dropping unknown fields in flow

MapSchema.plugin(mongooseTimestamp)

export default mongoose.model('Map', MapSchema)

