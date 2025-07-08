import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const Field = sequelize.define('field', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    field_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    field_name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'field',
    timestamps: false,
    underscored: true
})

export default Field
