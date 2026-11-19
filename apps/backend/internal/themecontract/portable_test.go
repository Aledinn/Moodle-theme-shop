package themecontract

import (
	"bytes"
	"os"
	"testing"
)

func TestDeploymentSchemaMatchesContract(t *testing.T) {
	source, err := os.ReadFile("../../../../contracts/theme/portable.schema.json")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(source, PortableSchema) {
		t.Fatal("update deployed portable.schema.json from contracts/theme")
	}
}
