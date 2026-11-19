package themecontract

import _ "embed"

// PortableSchema is a deployment copy of contracts/theme/portable.schema.json.
// The shared contract tests enforce byte-for-byte equality with the source.
//
//go:embed portable.schema.json
var PortableSchema []byte

var portableValidator, portableSchemaError = New(PortableSchema)

func ValidatePortable(data []byte) error {
	if portableSchemaError != nil {
		return portableSchemaError
	}
	return portableValidator.Validate(data)
}
