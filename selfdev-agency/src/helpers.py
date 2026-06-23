''' Helpers '''
import re
import json


def str_to_bool(val):
  """Convert a string representation of truth to true (1) or false (0).
  True values are 'y', 'yes', 't', 'true', 'on', and '1'; false values
  are 'n', 'no', 'f', 'false', 'off', and '0'.  Raises ValueError if
  'val' is anything else.
  """
  val = val.lower()
  if val in ('y', 'yes', 't', 'true', 'on', '1'):
    return True
  if val in ('n', 'no', 'f', 'false', 'off', '0'):
    return False
  raise ValueError(f"Invalid truth value {val}")


def extract_and_parse_json(input_string):
  '''
  Parses json from string knowing that there might be some symbols before and
  after the json `sym bols  {'key1': 'value1', 'key': 'value'} symbols symbols`
  '''
  # Look for content between curly braces (including the braces)
  json_pattern = r'(\{.*?\})'
  match = re.search(json_pattern, input_string, re.DOTALL)
  if match:
    # Extract the JSON string
    json_str = match.group(1)

    # Convert Python-style single quotes to JSON-compatible double quotes
    json_str = json_str.replace("'", '"')

    try:
      parsed_json = json.loads(json_str)
      return parsed_json
    except json.JSONDecodeError as e:
      raise ValueError(f"Error parsing JSON: {e}") from e
  else:
    raise ValueError("No JSON object found in the string")
