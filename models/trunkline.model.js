import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Field from './field.model.js'

const Trunkline = sequelize.define('trunkline', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    tline_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    tline_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    field_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: Field,
            key: 'field_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    }
}, {
    tableName: 'trunkline',
    timestamps: false,
    underscored: true
})

export default Trunkline
